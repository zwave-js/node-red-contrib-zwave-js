const path = require('path');
const { Driver } = require('zwave-js');
const driverVersion = require('zwave-js/package.json').version;
const { tryParseDSKFromQRCodeString, parseQRCodeString } = require('@zwave-js/core');
const { ConfigManager } = require('@zwave-js/config');

const ControllerAPI_Process = require('./lib/ControllerAPI').process;
const ValueAPI_Process = require('./lib/ValueAPI').process;
const CCAPI_Process = require('./lib/CCAPI').process;
const NodeAPI_Process = require('./lib/NodeAPI').process;
const Driver_Process = require('./lib/DriverAPI').process;
const { getNodes } = require('./lib/Fetchers');

const APP_NAME = require('../package.json').name;
const APP_VERSION = require('../package.json').version;
const FWK = '127c49b6f2928a6579e82ecab64a83fc94a6436f03d5cb670b8ac44412687b75f0667843';

class SanitizedEventName {
	constructor(event) {
		this.driverName = event;
		this.redEventName = event.replace(/ /g, '_').toUpperCase();
		this.nodeStatusName = event.charAt(0).toUpperCase() + event.substr(1).toLowerCase() + '.';
		this.statusNameWithNode = (Node) => {
			return `Node: ${Node.id} ${this.nodeStatusName}`;
		};
	}
}

// Create event objects (creates easy to use event hooks)
const event_DriverReady = new SanitizedEventName('driver ready');
const event_AllNodesReady = new SanitizedEventName('all nodes ready');
const event_NodeAdded = new SanitizedEventName('node added');
const event_NodeRemoved = new SanitizedEventName('node removed');
const event_InclusionStarted = new SanitizedEventName('inclusion started');
const event_InclusionFailed = new SanitizedEventName('inclusion failed');
const event_InclusionStopped = new SanitizedEventName('inclusion stopped');
const event_ExclusionStarted = new SanitizedEventName('exclusion started');
const event_ExclusionFailed = new SanitizedEventName('exclusion failed');
const event_ExclusionStopped = new SanitizedEventName('exclusion stopped');
const event_RebuildRoutesDone = new SanitizedEventName('rebuild routes done');
const event_FirmwareUpdateFinished = new SanitizedEventName('firmware update finished');
const event_FirmwareUpdateProgress = new SanitizedEventName('firmware update progress');
const event_ValueNotification = new SanitizedEventName('value notification');
const event_Notification = new SanitizedEventName('notification');
const event_ValueUpdated = new SanitizedEventName('value updated');
const event_ValueAdded = new SanitizedEventName('value added');
const event_Wake = new SanitizedEventName('wake up');
const event_Sleep = new SanitizedEventName('sleep');
const event_Dead = new SanitizedEventName('dead');
const event_Alive = new SanitizedEventName('alive');
const event_InterviewStarted = new SanitizedEventName('interview started');
const event_InterviewFailed = new SanitizedEventName('interview failed');
const event_InterviewCompleted = new SanitizedEventName('interview completed');
const event_Ready = new SanitizedEventName('ready');
const event_RebuildRoutesProgress = new SanitizedEventName('rebuild routes progress');
const event_NetworkJoined = new SanitizedEventName('network joined');
const event_NetworkLeft = new SanitizedEventName('network left');

module.exports = function (RED) {
	const init = function (config) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;

		const _ConfigManager = new ConfigManager();
		_ConfigManager.loadDeviceIndex();

		// S2 Promise Resolvers
		let grantPromise;
		let dskPromise;

		// Controller and Device Nodes
		let controllerNodes = {};
		let deviceNodes = {};

		// Public methods (used by config clients)
		self.registerDeviceNode = (DeviceNodeID, NodeIDs, Callback) => {
			const Nodes = NodeIDs.split(',').map((N) => parseInt(N));
			deviceNodes[DeviceNodeID] = { Nodes, Callback };
		};
		self.deregisterDeviceNode = (DeviceNodeID) => {
			delete deviceNodes[DeviceNodeID];
		};

		self.registerControllerNode = (ControllerNodeID, Callback) => {
			controllerNodes[ControllerNodeID] = Callback;
		};
		self.deregisterControllerNode = (ControllerNodeID) => {
			delete controllerNodes[ControllerNodeID];
		};

		self.controllerCommand = function (Method, Args) {
			if (self.driverInstance) {
				return ControllerAPI_Process(self.driverInstance, Method, Args);
			}
			return Promise.reject('Driver Instance');
		};

		self.valueCommand = function (Method, NodeID, VID, Value, Options) {
			if (self.driverInstance) {
				return ValueAPI_Process(self.driverInstance, Method, NodeID, VID, Value, Options);
			}
			return Promise.reject('Driver Instance');
		};

		self.ccCommand = function (Method, CommandClass, CommandClassMethod, NodeID, Endpoint, Args) {
			if (self.driverInstance) {
				return CCAPI_Process(self.driverInstance, Method, CommandClass, CommandClassMethod, NodeID, Endpoint, Args);
			}
			return Promise.reject('Driver Instance');
		};

		self.nodeCommand = function (Method, NodeID, Value, Args) {
			if (self.driverInstance) {
				return NodeAPI_Process(self.driverInstance, Method, NodeID, Value, Args);
			}
			return Promise.reject('Driver Instance');
		};

		self.driverCommand = function (Method, Args) {
			if (self.driverInstance) {
				return Driver_Process(self.driverInstance, Method, Args);
			}
			return Promise.reject('Driver Instance');
		};

		// Last status of network
		let lastStatus;

		// Send latest Status to UI and update current
		const updateLatestStatus = function (Status) {
			lastStatus = Status;
			RED.comms.publish(`zwave-js/ui/${self.id}/status`, { status: lastStatus }, false);
		};

		// Create Global API
		const exposeGlobalAPI = () => {
			if (self.config.enableGlobalAPI && self.driverInstance) {
				let Name = self.config.globalAPIName || self.id;
				Name = Name.replace(/ /g, '_');

				const API = {
					Nodes: this.driverInstance.controller.nodes,
					toJSON: function () {
						return {
							Nodes: 'Sorry, The Nodes collection cannot be represented here. It can only be used by Function nodes.'
						};
					}
				};

				Object.defineProperty(API, 'Nodes', {
					writable: false
				});

				Object.defineProperty(API, 'toJSON', {
					writable: false
				});

				self.context().global.set(`${Name}`, API);
			}
		};

		const removeGlobalAPI = () => {
			let Name = self.config.globalAPIName || self.id;
			Name = Name.replace(/ /g, '_');
			self.context().global.set(`${Name}`, undefined);
		};

		// Create HTTP API
		const createHTTPAPI = (resetHTTP) => {
			if (resetHTTP) {
				removeHTTPAPI();
			}

			RED.comms.publish('zwave-js/ui/global/addnetwork', { name: self.config.name, id: self.id }, false);

			RED.httpAdmin.get(`/zwave-js/ui/${self.id}/status`, RED.auth.needsPermission('flows.write'), (_, response) => {
				response.json({ callSuccess: true, response: lastStatus });
			});

			RED.httpAdmin.get(`/zwave-js/ui/${self.id}/version`, RED.auth.needsPermission('flows.write'), (_, response) => {
				response.json({
					callSuccess: true,
					response: {
						driverVersion: driverVersion,
						configVersion: self.driverInstance.configManager.configVersion,
						moudleVersion: APP_VERSION
					}
				});
			});

			RED.httpAdmin.post(
				`/zwave-js/ui/${self.id}/s2/grant`,
				RED.auth.needsPermission('flows.write'),
				(request, response) => {
					grantPromise(request.body[0]);
					response.json({ callSuccess: true });
				}
			);

			RED.httpAdmin.post(
				`/zwave-js/ui/${self.id}/s2/dsk`,
				RED.auth.needsPermission('flows.write'),
				(request, response) => {
					dskPromise(request.body[0]);
					response.json({ callSuccess: true });
				}
			);

			RED.httpAdmin.get(
				`/zwave-js/ui/${self.id}/s2/provisioningentries`,
				RED.auth.needsPermission('flows.write'),
				(_, response) => {
					const Entries = self.driverInstance?.controller.getProvisioningEntries();
					response.json({ callSuccess: true, response: Entries });
				}
			);

			RED.httpAdmin.post(
				`/zwave-js/ui/${self.id}/s2/parseqr`,
				RED.auth.needsPermission('flows.write'),
				async (request, response) => {
					const DSK = tryParseDSKFromQRCodeString(request.body[0]);

					if (DSK !== undefined) {
						response.json({
							callSuccess: true,
							response: {
								isDSK: true
							}
						});

						return;
					} else {
						let SSQR;
						try {
							SSQR = await parseQRCodeString(request.body[0]);
							_ConfigManager.lookupDevice(SSQR.manufacturerId, SSQR.productType, SSQR.productId).then((dc) => {
								response.json({
									callSuccess: true,
									response: {
										isDSK: false,
										qrProvisioningInformation: SSQR,
										deviceConfig: dc
									}
								});
							});
						} catch (Err) {
							response.json({
								callSuccess: false,
								response: Err.message
							});
						}
					}
				}
			);

			RED.httpAdmin.get(
				`/zwave-js/ui/${self.id}/:api/:method`,
				RED.auth.needsPermission('flows.write'),
				(request, response) => {
					const TargetAPI = request.params.api;
					const Method = request.params.method;
					let args = undefined;

					switch (TargetAPI) {
						case 'CONTROLLER':
							if (Method === 'beginJoiningNetwork') {
								args = [{ strategy: 0 }];
							}
							if (Method === 'backupNVMRaw') {
								args = [
									(bytesRead, total) => {
										RED.comms.publish(
											`zwave-js/ui/${self.id}/controller/nvm/backupprogress`,
											{ bytesRead, total, label: 'Extracting NVM...' },
											false
										);
									}
								];
							}
							self
								.controllerCommand(Method, args)
								.then((R) => {
									response.json({ callSuccess: true, response: R });
								})
								.catch((error) => {
									response.json({ callSuccess: false, response: error.message });
								});
							break;

						case 'DRIVER':
							if (Method === 'Restart') {
								Shutdown().then(() => {
									RED.comms.publish('zwave-js/ui/global/removenetwork', { id: self.id }, false);
									response.json({ callSuccess: true });
									Startup(true);
								});
								break;
							}

							self
								.driverCommand(Method)
								.then((R) => {
									response.json({ callSuccess: true, response: R });
								})
								.catch((error) => {
									response.json({ callSuccess: false, response: error.message });
								});
							break;
					}
				}
			);

			RED.httpAdmin.post(
				`/zwave-js/ui/${self.id}/:api/:method`,
				RED.auth.needsPermission('flows.write'),
				(request, response) => {
					const TargetAPI = request.params.api;
					const Method = request.params.method;
					let args = undefined;

					switch (TargetAPI) {
						case 'NODE':
							if (Method === 'checkLifelineHealth') {
								const CB = (round, totalRounds, lastRating, lastResult) => {
									RED.comms.publish(
										`zwave-js/ui/${self.id}/nodes/healthcheck`,
										{ nodeId: request.body.nodeId, check: { round, totalRounds, lastRating, lastResult } },
										false
									);
								};
								args = [5, CB];
							}
							self
								.nodeCommand(Method, request.body.nodeId, request.body.value, args)
								.then((R) => {
									response.json({ callSuccess: true, response: R });
								})
								.catch((error) => {
									response.json({ callSuccess: false, response: error.message });
								});
							break;
						case 'VALUE':
							self
								.valueCommand(Method, request.body.nodeId, request.body.valueId, request.body.value)
								.then((R) => {
									response.json({ callSuccess: true, response: R });
								})
								.catch((error) => {
									response.json({ callSuccess: false, response: error.message });
								});
							break;

						case 'CONTROLLER':
							args = request.body;
							if (Method === 'restoreNVM') {
								const byteArray = Object.values(args[0].bytes);
								const uint8Array = new Uint8Array(byteArray);
								const Send = (Label, done, total) => {
									RED.comms.publish(
										`zwave-js/ui/${self.id}/controller/nvm/restoreprogress`,
										{ done, total, label: Label },
										false
									);
								};
								args = [
									uint8Array,
									(bytesRead, total) => {
										Send('Converting Restore...', bytesRead, total);
									},
									(bytesWritten, total) => {
										Send('Writing to NVM...', bytesWritten, total);
									}
								];
							}
							self
								.controllerCommand(Method, args)
								.then((R) => {
									response.json({ callSuccess: true, response: R });
								})
								.catch((error) => {
									response.json({ callSuccess: false, response: error.message });
								});
							break;

						case 'DRIVER':
							args = request.body;
							if (Method === 'firmwareUpdateOTW') {
								const byteArray = Object.values(args[0].bytes);
								const uint8Array = new Uint8Array(byteArray);
								args = [uint8Array];
							}
							self
								.driverCommand(Method, args)
								.then((R) => {
									response.json({ callSuccess: true, response: R });
								})
								.catch((error) => {
									response.json({ callSuccess: false, response: error.message });
								});
							break;
					}
				}
			);
		};

		// Remove HTTP API
		const removeHTTPAPI = () => {
			const Check = (Route) => {
				if (Route.route === undefined) return true;
				if (!Route.route.path.startsWith(`/zwave-js/ui/${self.id}`)) return true;
				return false;
			};
			RED.comms.publish('zwave-js/ui/global/removenetwork', { id: self.id }, false);
			RED.httpAdmin._router.stack = RED.httpAdmin._router.stack.filter(Check);
		};

		// On close
		self.on('close', function (_, done) {
			removeGlobalAPI();
			removeHTTPAPI();
			controllerNodes = {};
			deviceNodes = {};
			Shutdown().then(() => {
				done();
			});
		});

		// S2 Callbacks
		const s2Void = () => {
			RED.comms.publish(`zwave-js/ui/${self.id}/s2/void`, {}, false);
		};
		const grantSecurityClasses = (Request) => {
			return new Promise((resolve) => {
				RED.comms.publish(`zwave-js/ui/${self.id}/s2/grant`, Request, false);
				grantPromise = resolve;
			});
		};
		const validateDSKAndEnterPIN = (DSK) => {
			return new Promise((resolve) => {
				RED.comms.publish(`zwave-js/ui/${self.id}/s2/dsk`, { dsk: DSK }, false);
				dskPromise = resolve;
			});
		};
		const showDSK = (DSK) => {
			RED.comms.publish(`zwave-js/ui/${self.id}/controller/slave/dsk`, { slaveJoinDSK: DSK }, false);
		};
		const DSKDone = () => {
			return;
		};

		// Driver settings
		const ZWaveOptions = {
			logConfig: {},
			timeouts: {},
			securityKeys: {},
			securityKeysLongRange: {},
			features: {
				softReset: self.config.enableSoftReset
			},

			storage: {
				throttle: self.config.storage_throttle,
				cacheDir: path.join(RED.settings.userDir || '', 'zwave-js-cache')
			},
			preferences: {
				scales: {
					temperature: parseInt(self.config.preferences_scales_temperature),
					humidity: parseInt(self.config.preferences_scales_humidity)
				}
			},
			interview: {
				queryAllUserCodes: self.config.interview_queryAllUserCodes
			},

			apiKeys: {
				firmwareUpdateService: self.config.apiKeys_firmwareUpdateService || FWK
			},
			inclusionUserCallbacks: {
				grantSecurityClasses: grantSecurityClasses,
				validateDSKAndEnterPIN: validateDSKAndEnterPIN,
				abort: s2Void
			},
			joinNetworkUserCallbacks: {
				showDSK: showDSK,
				done: DSKDone
			},
			disableOptimisticValueUpdate: !self.config.disableOptimisticValueUpdate
		};

		if (self.config.storage_deviceConfigPriorityDir) {
			ZWaveOptions.storage.deviceConfigPriorityDir = self.config.storage_deviceConfigPriorityDir;
		}

		// Cleanup Logging config
		const LogEnabled = self.config.logConfig_level !== 'off';
		ZWaveOptions.logConfig.enabled = LogEnabled;
		ZWaveOptions.logConfig.logToFile = LogEnabled;
		ZWaveOptions.logConfig.filename = path.join(RED.settings.userDir || '', 'zwavejs');
		if (LogEnabled) {
			ZWaveOptions.logConfig.level = self.config.logConfig_level;
		}
		let nodeLogFilter;
		if (self.config.LogConfig_nodeFilter) {
			nodeLogFilter = self.config.LogConfig_nodeFilter.split(',').map((N) => parseInt(N.trim()));
			ZWaveOptions.logConfig.nodeFilter = nodeLogFilter;
		}

		// Cleanup Timeouts
		if (self.config.timeouts_ack) ZWaveOptions.timeouts.ack = parseInt(self.config.timeouts_ack);
		if (self.config.timeouts_report) ZWaveOptions.timeouts.report = parseInt(self.config.timeouts_report);
		if (self.config.timeouts_response) ZWaveOptions.timeouts.response = parseInt(self.config.timeouts_response);
		if (self.config.timeouts_serialAPIStarted)
			ZWaveOptions.timeouts.serialAPIStarted = parseInt(self.config.timeouts_serialAPIStarted);
		if (self.config.timeouts_sendDataCallback)
			ZWaveOptions.timeouts.sendDataCallback = parseInt(self.config.timeouts_sendDataCallback);

		// Cleanup Keys
		if (self.config.securityKeys_S0_Legacy)
			ZWaveOptions.securityKeys.S0_Legacy = Buffer.from(self.config.securityKeys_S0_Legacy, 'hex');
		if (self.config.securityKeys_S2_AccessControl)
			ZWaveOptions.securityKeys.S2_AccessControl = Buffer.from(self.config.securityKeys_S2_AccessControl, 'hex');
		if (self.config.securityKeys_S2_Authenticated)
			ZWaveOptions.securityKeys.S2_Authenticated = Buffer.from(self.config.securityKeys_S2_Authenticated, 'hex');
		if (self.config.securityKeys_S2_Unauthenticated)
			ZWaveOptions.securityKeys.S2_Unauthenticated = Buffer.from(self.config.securityKeys_S2_Unauthenticated, 'hex');

		if (self.config.securityKeys_S2LR_Authenticated)
			ZWaveOptions.securityKeysLongRange.S2_Authenticated = Buffer.from(
				self.config.securityKeys_S2LR_Authenticated,
				'hex'
			);

		if (self.config.securityKeys_S2LR_AccessControl)
			ZWaveOptions.securityKeysLongRange.S2_AccessControl = Buffer.from(
				self.config.securityKeys_S2LR_AccessControl,
				'hex'
			);

		// Driver callback subscriptions
		const wireDriverEvents = (resetHTTP) => {
			// Driver ready
			self.driverInstance?.once(event_DriverReady.driverName, () => {
				exposeGlobalAPI();
				createHTTPAPI(resetHTTP);
				wireSubDriverEvents();

				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'yellow',
						shape: 'dot',
						text: 'Initializing network nodes...'
					}
				};
				updateLatestStatus('Initializing network nodes...');
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Status);
				});
				self.driverInstance?.controller.nodes.forEach((Node) => {
					wireNodeEvents(Node);
				});
			});
		};

		// Driver callback subscriptions that occure after driver ready
		const wireSubDriverEvents = () => {
			// Joined As Slave
			self.driverInstance?.controller.on(event_NetworkJoined.driverName, () => {
				self.driverInstance?.controller.nodes.forEach((Node) => {
					wireNodeEvents(Node);
				});
				RED.comms.publish(`zwave-js/ui/${self.id}/controller/slave/joined`, {}, false);
			});

			// Left As Slave
			self.driverInstance?.controller.on(event_NetworkLeft.driverName, () => {
				RED.comms.publish(`zwave-js/ui/${self.id}/controller/slave/left`, {}, false);
			});

			// Firmware Update Progress (Controller)
			self.driverInstance?.on(event_FirmwareUpdateProgress.driverName, (progress) => {
				RED.comms.publish(`zwave-js/ui/${self.id}/driver/firmwareupdate/progress`, { ...progress }, false);
			});

			// Firmware Update Completed (Controller)
			self.driverInstance?.on(event_FirmwareUpdateFinished.driverName, (result) => {
				RED.comms.publish(`zwave-js/ui/${self.id}/driver/firmwareupdate/finished`, { ...result }, false);
			});

			// Al Nodes Ready
			self.driverInstance?.on(event_AllNodesReady.driverName, () => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event = {
					Type: 'EVENT',
					Event: { event: event_AllNodesReady.redEventName, timestamp: Timestamp }
				};
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'green',
						shape: 'dot',
						text: event_AllNodesReady.nodeStatusName,
						clearTime: 5000
					}
				};
				updateLatestStatus(event_AllNodesReady.nodeStatusName);
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Event);
					controllerNodes[ID](Status);
				});
			});

			// Node Added
			self.driverInstance?.controller.on(event_NodeAdded.driverName, (ThisNode, Result) => {
				const ControllerNodeIDs = Object.keys(controllerNodes);

				RED.comms.publish(
					`zwave-js/ui/${this.id}/nodes/added`,
					{
						nodeId: ThisNode.id,
						highestSecurityClass: ThisNode.getHighestSecurityClass(),
						lowSecurity: Result.lowSecurity
					},
					false
				);

				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'green',
						shape: 'dot',
						text: event_NodeAdded.statusNameWithNode(ThisNode),
						clearTime: 5000
					}
				};
				updateLatestStatus(event_NodeAdded.statusNameWithNode(ThisNode));
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Status);
				});
				wireNodeEvents(ThisNode);
			});

			// Node Removed
			self.driverInstance?.controller.on(event_NodeRemoved.driverName, (ThisNode, Reason) => {
				const ControllerNodeIDs = Object.keys(controllerNodes);
				RED.comms.publish(`zwave-js/ui/${this.id}/nodes/removed`, { nodeId: ThisNode.id, reason: Reason }, false);
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'green',
						shape: 'dot',
						text: event_NodeRemoved.statusNameWithNode(ThisNode),
						clearTime: 5000
					}
				};
				updateLatestStatus(event_NodeRemoved.statusNameWithNode(ThisNode));
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Status);
				});
			});

			// inclusion started
			self.driverInstance?.controller.on(event_InclusionStarted.driverName, (IsSecure, _Strategy) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Body = {
					isSecureInclude: IsSecure
				};
				const Event = {
					Type: 'EVENT',
					Event: { event: event_InclusionStarted.redEventName, timestamp: Timestamp, eventBody: Body }
				};
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'yellow',
						shape: 'dot',
						text: event_InclusionStarted.nodeStatusName
					}
				};
				updateLatestStatus(event_InclusionStarted.nodeStatusName);
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Event);
					controllerNodes[ID](Status);
				});
			});

			// inclusion failed
			self.driverInstance?.controller.on(event_InclusionFailed.driverName, () => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event = {
					Type: 'EVENT',
					Event: { event: event_InclusionFailed.redEventName, timestamp: Timestamp }
				};
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'red',
						shape: 'dot',
						text: event_InclusionFailed.nodeStatusName,
						clearTime: 5000
					}
				};
				updateLatestStatus(event_InclusionFailed.nodeStatusName);
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Event);
					controllerNodes[ID](Status);
				});
			});

			// inclusion stopped
			self.driverInstance?.controller.on(event_InclusionStopped.driverName, () => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event = {
					Type: 'EVENT',
					Event: { event: event_InclusionStopped.redEventName, timestamp: Timestamp }
				};
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'yellow',
						shape: 'ring',
						text: event_InclusionStopped.nodeStatusName,
						clearTime: 5000
					}
				};
				updateLatestStatus(event_InclusionStopped.nodeStatusName);
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Event);
					controllerNodes[ID](Status);
				});
			});

			// exclusion started
			self.driverInstance?.controller.on(event_ExclusionStarted.driverName, () => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event = {
					Type: 'EVENT',
					Event: { event: event_ExclusionStarted.redEventName, timestamp: Timestamp }
				};
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'yellow',
						shape: 'dot',
						text: event_ExclusionStarted.nodeStatusName
					}
				};
				updateLatestStatus(event_ExclusionStarted.nodeStatusName);
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Event);
					controllerNodes[ID](Status);
				});
			});

			// exclusion failed
			self.driverInstance?.controller.on(event_ExclusionFailed.driverName, () => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event = {
					Type: 'EVENT',
					Event: { event: event_ExclusionFailed.redEventName, timestamp: Timestamp }
				};
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'red',
						shape: 'dot',
						text: event_ExclusionFailed.nodeStatusName,
						clearTime: 5000
					}
				};
				updateLatestStatus(event_ExclusionFailed.nodeStatusName);
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Event);
					controllerNodes[ID](Status);
				});
			});

			// exclusion stopped
			self.driverInstance?.controller.on(event_ExclusionStopped.driverName, () => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event = {
					Type: 'EVENT',
					Event: { event: event_ExclusionStopped.redEventName, timestamp: Timestamp }
				};
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'yellow',
						shape: 'ring',
						text: event_ExclusionStopped.nodeStatusName,
						clearTime: 5000
					}
				};
				updateLatestStatus(event_ExclusionStopped.nodeStatusName);
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Event);
					controllerNodes[ID](Status);
				});
			});

			// Heal finnished
			self.driverInstance?.controller.on(event_RebuildRoutesDone.driverName, (Result) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event = {
					Type: 'EVENT',
					Event: { event: event_RebuildRoutesDone.redEventName, timestamp: Timestamp, eventBody: Result }
				};
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'green',
						shape: 'dot',
						text: event_RebuildRoutesDone.nodeStatusName,
						clearTime: 5000
					}
				};
				updateLatestStatus(event_RebuildRoutesDone.nodeStatusName);
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Event);
					controllerNodes[ID](Status);
				});
			});

			// Heal Progress
			self.driverInstance?.controller.on(event_RebuildRoutesProgress.driverName, (Progress) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event = {
					Type: 'EVENT',
					Event: { event: event_RebuildRoutesProgress.redEventName, timestamp: Timestamp, eventBody: Progress }
				};
				const Count = Progress.size;
				const Remain = [...Progress.values()].filter((V) => V === 'pending').length;
				const Completed = Count - Remain;
				const CompletedPercentage = Math.round((100 * Completed) / (Completed + Remain));
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'yellow',
						shape: 'dot',
						text: `Heal network progress : ${CompletedPercentage}%`
					}
				};
				updateLatestStatus(`Heal network progress : ${CompletedPercentage}%`);
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Event);
					controllerNodes[ID](Status);
				});
			});
		};

		// Node callback subscriptions
		const wireNodeEvents = (Node) => {
			if (Node.isControllerNode) {
				return;
			}

			// Ready
			Node.on(event_Ready.driverName, (ThisNode) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(deviceNodes).filter(
					(I) => I.Nodes.includes(Node.id) || I.Nodes[0] === 0
				);
				const Event = {
					Type: 'EVENT',
					Event: {
						event: event_Ready.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));

				const NodeInfo = getNodes(self.driverInstance).find((N) => N.nodeId === ThisNode.id);
				RED.comms.publish(`zwave-js/ui/${this.id}/nodes/ready`, { nodeInfo: NodeInfo }, false);
			});

			// Alive
			Node.on(event_Alive.driverName, (ThisNode, OldStatus) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(deviceNodes).filter(
					(I) => I.Nodes.includes(Node.id) || I.Nodes[0] === 0
				);
				const Event = {
					Type: 'EVENT',
					Event: {
						event: event_Alive.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: { oldStatus: OldStatus }
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));

				const NodeInfo = getNodes(self.driverInstance).find((N) => N.nodeId === ThisNode.id);
				RED.comms.publish(`zwave-js/ui/${this.id}/nodes/alive`, { nodeInfo: NodeInfo }, false);
			});

			// Wake
			Node.on(event_Wake.driverName, (ThisNode, OldStatus) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(deviceNodes).filter(
					(I) => I.Nodes.includes(Node.id) || I.Nodes[0] === 0
				);
				const Event = {
					Type: 'EVENT',
					Event: {
						event: event_Wake.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: { oldStatus: OldStatus }
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));

				const NodeInfo = getNodes(self.driverInstance).find((N) => N.nodeId === ThisNode.id);
				RED.comms.publish(`zwave-js/ui/${this.id}/nodes/wakeup`, { nodeInfo: NodeInfo }, false);
			});

			// Sleep
			Node.on(event_Sleep.driverName, (ThisNode, OldStatus) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(deviceNodes).filter(
					(I) => I.Nodes.includes(Node.id) || I.Nodes[0] === 0
				);
				const Event = {
					Type: 'EVENT',
					Event: {
						event: event_Sleep.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: { oldStatus: OldStatus }
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));

				const NodeInfo = getNodes(self.driverInstance).find((N) => N.nodeId === ThisNode.id);
				RED.comms.publish(`zwave-js/ui/${this.id}/nodes/sleep`, { nodeInfo: NodeInfo }, false);
			});

			// Dead
			Node.on(event_Dead.driverName, (ThisNode, OldStatus) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(deviceNodes).filter(
					(I) => I.Nodes.includes(Node.id) || I.Nodes[0] === 0
				);
				const Event = {
					Type: 'EVENT',
					Event: {
						event: event_Dead.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: { oldStatus: OldStatus }
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));

				const NodeInfo = getNodes(self.driverInstance).find((N) => N.nodeId === ThisNode.id);
				RED.comms.publish(`zwave-js/ui/${this.id}/nodes/dead`, { nodeInfo: NodeInfo }, false);
			});

			// Interview Started
			Node.on(event_InterviewStarted.driverName, (ThisNode) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event = {
					Type: 'EVENT',
					Event: { event: event_InterviewStarted.redEventName, timestamp: Timestamp }
				};
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'yellow',
						shape: 'dot',
						text: event_InterviewStarted.statusNameWithNode(ThisNode)
					}
				};
				updateLatestStatus(event_InterviewStarted.statusNameWithNode(ThisNode));
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Event);
					controllerNodes[ID](Status);
				});

				const NodeInfo = getNodes(self.driverInstance).find((N) => N.nodeId === ThisNode.id);
				RED.comms.publish(`zwave-js/ui/${this.id}/nodes/interviewstarted`, { nodeInfo: NodeInfo }, false);
			});

			// Interview Completed
			Node.on(event_InterviewCompleted.driverName, (ThisNode) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event = {
					Type: 'EVENT',
					Event: { event: event_InterviewCompleted.redEventName, timestamp: Timestamp }
				};
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'green',
						shape: 'dot',
						text: event_InterviewCompleted.statusNameWithNode(ThisNode),
						clearTime: 5000
					}
				};
				updateLatestStatus(event_InterviewCompleted.statusNameWithNode(ThisNode));
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Event);
					controllerNodes[ID](Status);
				});

				const NodeInfo = getNodes(self.driverInstance).find((N) => N.nodeId === ThisNode.id);
				RED.comms.publish(`zwave-js/ui/${this.id}/nodes/interviewed`, { nodeInfo: NodeInfo }, false);
			});

			// Interview Failed
			Node.on(event_InterviewFailed.driverName, (ThisNode, Args) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event = {
					Type: 'EVENT',
					Event: { event: event_InterviewFailed.redEventName, timestamp: Timestamp, eventBody: Args }
				};
				const Status = {
					Type: 'STATUS',
					Status: {
						fill: 'red',
						shape: 'dot',
						text: event_InterviewFailed.statusNameWithNode(ThisNode),
						clearTime: 5000
					}
				};
				updateLatestStatus(event_InterviewFailed.statusNameWithNode(ThisNode));
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Event);
					controllerNodes[ID](Status);
				});

				const NodeInfo = getNodes(self.driverInstance).find((N) => N.nodeId === ThisNode.id);
				RED.comms.publish(`zwave-js/ui/${this.id}/nodes/interviewfailed`, { nodeInfo: NodeInfo }, false);
			});

			// Value Notification
			Node.on(event_ValueNotification.driverName, (ThisNode, Args) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(deviceNodes).filter(
					(I) => I.Nodes.includes(Node.id) || I.Nodes[0] === 0
				);
				const { value, ...valueId } = Args;
				const Event = {
					Type: 'EVENT',
					Event: {
						event: event_ValueNotification.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: { valueId, value }
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
			});

			// Value updated
			Node.on(event_ValueUpdated.driverName, (ThisNode, Args) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(deviceNodes).filter(
					(I) => I.Nodes.includes(Node.id) || I.Nodes[0] === 0
				);
				const { newValue, prevValue, ...valueId } = Args;
				const Event = {
					Type: 'EVENT',
					Event: {
						event: event_ValueUpdated.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: { valueId, newValue, prevValue }
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
				RED.comms.publish(
					`zwave-js/ui/${this.id}/nodes/valueupdate`,
					{ nodeId: ThisNode.id, eventBody: Event.Event.eventBody },
					false
				);
			});

			// Value Added
			Node.on(event_ValueAdded.driverName, (ThisNode, Args) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(deviceNodes).filter(
					(I) => I.Nodes.includes(Node.id) || I.Nodes[0] === 0
				);
				const { newValue, ...valueId } = Args;
				const Event = {
					Type: 'EVENT',
					Event: {
						event: event_ValueAdded.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: { valueId, newValue }
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
				RED.comms.publish(
					`zwave-js/ui/${this.id}/nodes/valueadded`,
					{ nodeId: ThisNode.id, eventBody: Event.Event.eventBody },
					false
				);
			});

			// Notification
			Node.on(event_Notification.driverName, (Endpoint, CC, Args) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(deviceNodes).filter(
					(I) => I.Nodes.includes(Node.id) || I.Nodes[0] === 0
				);
				const Event = {
					Type: 'EVENT',
					Event: {
						event: event_Notification.redEventName,
						timestamp: Timestamp,
						nodeId: Endpoint.nodeId,
						nodeName: Node.name,
						nodeLocation: Node.location,
						eventBody: { ccId: CC, args: Args }
					}
				};

				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
			});
		};

		const Shutdown = async () => {
			if (self.driverInstance) {
				await self.driverInstance.destroy();
				self.driverInstance = undefined;
			}
		};

		const Startup = (resetHTTP) => {
			try {
				self.driverInstance = new Driver(self.config.serialPort, ZWaveOptions);
			} catch (err) {
				self.error(err);
				return;
			}

			if (self.config.enableStatistics) {
				self.driverInstance?.enableStatistics({
					applicationName: APP_NAME,
					applicationVersion: APP_VERSION
				});
			} else {
				self.driverInstance?.disableStatistics();
			}

			wireDriverEvents(resetHTTP);

			self.driverInstance?.on('error', (Err) => {
				self.error(Err);
			});

			self.driverInstance
				.start()
				.catch((e) => {
					self.error(e);
				})
				.then(() => {
					//
				});
		};

		Startup(false);
	};

	RED.nodes.registerType('zwavejs-runtime', init);
};
