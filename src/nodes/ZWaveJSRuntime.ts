import path from 'path';
import { NodeAPI } from 'node-red';
import { Type_ZWaveJSRuntimeConfig } from '../types/Type_ZWaveJSRuntimeConfig';
import {
	Type_ZWaveJSRuntime,
	MessageType,
	DeviceCallback,
	ControllerCallback,
	ControllerCallbackObject,
	DeviceCallbackObject,
	API
} from '../types/Type_ZWaveJSRuntime';
import {
	Driver,
	InclusionGrant,
	ZWaveNode,
	HealNodeStatus,
	ZWaveNodeValueNotificationArgs,
	ZWaveNodeValueUpdatedArgs,
	NodeInterviewFailedEventArgs,
	ZWaveNodeValueAddedArgs,
	InclusionResult,
	ValueID
} from 'zwave-js';
import { process as ControllerAPI_Process } from '../lib/ControllerAPI';
import { process as ValueAPI_Process } from '../lib/ValueAPI';
import { Tail } from 'tail';

const APP_NAME = 'node-red-contrib-zwave-js';
const APP_VERSION = '9.0.0';
const FWK = '127c49b6f2928a6579e82ecab64a83fc94a6436f03d5cb670b8ac44412687b75f0667843';

// Event hook class
class SanitizedEventName {
	driverName: any;
	redEventName: string;
	nodeStatusName: string;
	statusNameWithNode: (Node: ZWaveNode) => string;

	constructor(event: string) {
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
const event_NetworkHealDone = new SanitizedEventName('heal network done');
//const event_FirmwareUpdateFinished = new SanitizedEventName('firmware update finished');
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
const event_HealNetworkProgress = new SanitizedEventName('heal network progress');

module.exports = (RED: NodeAPI) => {
	const init = function (this: Type_ZWaveJSRuntime, config: Type_ZWaveJSRuntimeConfig) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;

		// Tail Log
		let tailLog: Tail | undefined;

		// S2 Promise Resolvers
		let grantPromise: (Value: InclusionGrant | false) => void;
		let dskPromise: (Value: string | false) => void;

		// Controller and Device Nodes
		let controllerNodes: { [ControllerNodeID: string]: ControllerCallback } = {};
		let deviceNodes: { [DeviceNodeID: string]: { NodeIDs?: number[]; Callback: DeviceCallback } } = {};

		// Public methods (used by config clients)
		self.registerDeviceNode = (DeviceNodeID, NodeIDs, Callback) => {
			deviceNodes[DeviceNodeID] = { NodeIDs, Callback };
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

		self.controllerCommand = (Method, Params): Promise<any> => {
			if (self.driverInstance) {
				return ControllerAPI_Process(self.driverInstance, Method, Params);
			}
			return Promise.reject('Driver Instance');
		};

		self.valueCommand = (Method, NodeID, VID, Value?, Options?): Promise<any> => {
			if (self.driverInstance) {
				return ValueAPI_Process(self.driverInstance, Method, NodeID, VID, Value, Options);
			}
			return Promise.reject('Driver Instance');
		};

		// Last status of network
		let lastStatus: string;

		// Send latest Status to UI and update current
		const updateLatestStatus = (Status: string) => {
			lastStatus = Status;
			RED.comms.publish(`zwave-js/ui/${self.id}/status`, { status: lastStatus }, false);
		};

		// Create Global API
		const exposeGlobalAPI = () => {
			if (self.config.enableGlobalAPI && self.driverInstance) {
				let Name = self.config.globalAPIName || self.id;
				Name = Name.replace(/ /g, '_');

				const API = {
					Driver: this.driverInstance,
					toJSON: function () {
						return {
							Driver: 'Sorry, The Driver cannot be represented here. It can only be used by Function nodes.'
						};
					}
				};

				Object.defineProperty(API, 'Driver', {
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
		const createHTTPAPI = () => {
			RED.comms.publish('zwave-js/ui/global/addnetwork', { name: self.config.name, id: self.id }, false);

			RED.httpAdmin.get(`/zwave-js/ui/${self.id}/status`, RED.auth.needsPermission('flows.write'), (_, response) => {
				response.json({ callSuccess: true, response: lastStatus });
			});

			RED.httpAdmin.post(
				`/zwave-js/ui/${self.id}/log`,
				RED.auth.needsPermission('flows.write'),
				(request, response) => {
					if (request.body.stream) {
						if (self.config.logConfig_level !== 'off') {
							tailLog = new Tail(path.join(RED.settings.userDir || '', 'zwavejs_current.log'));
							tailLog.on('line', (data) => {
								RED.comms.publish(`zwave-js/ui/${self.id}/log`, { log: `${data.toString()}\r\n` }, false);
							});
							response.json({ callSuccess: true, response: true });
						} else {
							response.json({ callSuccess: true, response: false });
						}
					} else {
						if (tailLog) {
							tailLog.unwatch();
							tailLog = undefined;
						}
						response.json({ callSuccess: true });
					}
				}
			);

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
				`/zwave-js/ui/${self.id}/:api/:action`,
				RED.auth.needsPermission('flows.write'),
				(request, response) => {
					const TypedAPIString: keyof typeof API = request.params.api as any;
					const TargetAPI = API[TypedAPIString];
					const Method = request.params.action;

					switch (TargetAPI) {
						case API.CONTROLLER:
							self
								.controllerCommand(Method)
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
					const TypedAPIString: keyof typeof API = request.params.api as any;
					const TargetAPI = API[TypedAPIString];
					const Method = request.params.method;

					switch (TargetAPI) {
						case API.VALUE:
							self
								.valueCommand(
									Method,
									request.body.nodeId as number,
									request.body.valueId as ValueID,
									request.body.value
								)
								.then((R) => {
									response.json({ callSuccess: true, response: R });
								})
								.catch((error) => {
									response.json({ callSuccess: false, response: error.message });
								});
							break;

						case API.CONTROLLER:
							self
								.controllerCommand(Method, request.body)
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
			const Check = (Route: any) => {
				if (Route.route === undefined) return true;
				if (!Route.route.path.startsWith(`/zwave-js/ui/${self.id}`)) return true;
				return false;
			};
			RED.comms.publish('zwave-js/ui/global/removenetwork', { id: self.id }, false);
			RED.httpAdmin._router.stack = RED.httpAdmin._router.stack.filter(Check);
		};

		// On close
		self.on('close', (_: boolean, done: () => void) => {
			removeGlobalAPI();
			removeHTTPAPI();
			controllerNodes = {};
			deviceNodes = {};
			if (tailLog) {
				tailLog.unwatch();
				tailLog = undefined;
			}
			if (self.driverInstance) {
				self.driverInstance?.destroy().then(() => {
					self.driverInstance = undefined;
					done();
				});
			} else {
				done();
			}
		});

		// S2 Callbacks
		const s2Void = (): void => {
			RED.comms.publish(`zwave-js/ui/${self.id}/s2/void`, {}, false);
		};
		const grantSecurityClasses = (Request: InclusionGrant): Promise<InclusionGrant | false> => {
			return new Promise((resolve) => {
				RED.comms.publish(`zwave-js/ui/${self.id}/s2/grant`, Request, false);
				grantPromise = resolve;
			});
		};
		const validateDSKAndEnterPIN = (DSK: string): Promise<string | false> => {
			return new Promise((resolve) => {
				RED.comms.publish(`zwave-js/ui/${self.id}/s2/dsk`, { dsk: DSK }, false);
				dskPromise = resolve;
			});
		};

		// Driver settings
		const ZWaveOptions: Record<string, any> = {
			logConfig: {},
			timeouts: {},
			securityKeys: {},
			storage: {
				throttle: self.config.storage_throttle,
				cacheDir: path.join(RED.settings.userDir || '', 'zwave-js-cache')
			},
			preferences: {
				scales: {
					temperature: self.config.preferences_scales_temperature,
					humidity: self.config.preferences_scales_humidity
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
			disableOptimisticValueUpdate: !self.config.disableOptimisticValueUpdate,
			enableSoftReset: self.config.enableSoftReset
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
		let nodeLogFilter: number[] | undefined;
		if (self.config.LogConfig_nodeFilter) {
			nodeLogFilter = self.config.LogConfig_nodeFilter.split(',').map((N) => parseInt(N.trim()));
			ZWaveOptions.logConfig.nodeFilter = nodeLogFilter;
		}

		// Cleanup Timeouts
		if (self.config.timeouts_ack) ZWaveOptions.timeouts.ack = self.config.timeouts_ack;
		if (self.config.timeouts_report) ZWaveOptions.timeouts.report = self.config.timeouts_report;
		if (self.config.timeouts_response) ZWaveOptions.timeouts.response = self.config.timeouts_response;
		if (self.config.timeouts_serialAPIStarted)
			ZWaveOptions.timeouts.serialAPIStarted = self.config.timeouts_serialAPIStarted;
		if (self.config.timeouts_sendDataCallback)
			ZWaveOptions.timeouts.sendDataCallback = self.config.timeouts_sendDataCallback;

		// Cleanup Keys
		if (self.credentials.securityKeys_S0_Legacy)
			ZWaveOptions.securityKeys.S0_Legacy = Buffer.from(self.credentials.securityKeys_S0_Legacy, 'hex');
		if (self.credentials.securityKeys_S2_AccessControl)
			ZWaveOptions.securityKeys.S2_AccessControl = Buffer.from(self.credentials.securityKeys_S2_AccessControl, 'hex');
		if (self.credentials.securityKeys_S2_Authenticated)
			ZWaveOptions.securityKeys.S2_Authenticated = Buffer.from(self.credentials.securityKeys_S2_Authenticated, 'hex');
		if (self.credentials.securityKeys_S2_Unauthenticated)
			ZWaveOptions.securityKeys.S2_Unauthenticated = Buffer.from(
				self.credentials.securityKeys_S2_Unauthenticated,
				'hex'
			);

		// Driver callback subscriptions
		const wireDriverEvents = (): void => {
			// Driver ready
			self.driverInstance?.once(event_DriverReady.driverName, () => {
				exposeGlobalAPI();
				createHTTPAPI();
				wireSubDriverEvents();

				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'yellow',
						shape: 'dot',
						text: 'Initializing network...'
					}
				};
				updateLatestStatus('Initializing network...');
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
			// Al Nodes Ready
			self.driverInstance?.on(event_AllNodesReady.driverName, () => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_AllNodesReady.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
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
			self.driverInstance?.controller.on(event_NodeAdded.driverName, (Node: ZWaveNode, Result: InclusionResult) => {
				const ControllerNodeIDs = Object.keys(controllerNodes);

				RED.comms.publish(
					`zwave-js/ui/${this.id}/nodes/added`,
					{ nodeId: Node.id, highestSecurityClass: Node.getHighestSecurityClass(), lowSecurity: Result.lowSecurity },
					false
				);

				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'green',
						shape: 'dot',
						text: event_NodeAdded.statusNameWithNode(Node),
						clearTime: 5000
					}
				};
				updateLatestStatus(event_NodeAdded.statusNameWithNode(Node));
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Status);
				});
				wireNodeEvents(Node);
			});

			// Node Removed
			self.driverInstance?.controller.on(event_NodeRemoved.driverName, (Node: ZWaveNode) => {
				const ControllerNodeIDs = Object.keys(controllerNodes);

				RED.comms.publish(`zwave-js/ui/${this.id}/nodes/removed`, { nodeId: Node.id }, false);

				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'green',
						shape: 'dot',
						text: event_NodeRemoved.statusNameWithNode(Node),
						clearTime: 5000
					}
				};
				updateLatestStatus(event_NodeRemoved.statusNameWithNode(Node));
				ControllerNodeIDs.forEach((ID) => {
					controllerNodes[ID](Status);
				});
			});

			// inclusion started
			self.driverInstance?.controller.on(event_InclusionStarted.driverName, (IsSecure: boolean) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Body = {
					isSecureInclude: IsSecure
				};
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_InclusionStarted.redEventName, timestamp: Timestamp, eventBody: Body }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
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
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_InclusionFailed.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
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
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_InclusionStopped.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
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
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_ExclusionStarted.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
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
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_ExclusionFailed.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
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
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_ExclusionStopped.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
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
			self.driverInstance?.controller.on(
				event_NetworkHealDone.driverName,
				(Result: ReadonlyMap<number, HealNodeStatus>) => {
					const Timestamp = new Date().getTime();
					const ControllerNodeIDs = Object.keys(controllerNodes);
					const Event: ControllerCallbackObject = {
						Type: MessageType.EVENT,
						Event: { event: event_NetworkHealDone.redEventName, timestamp: Timestamp, eventBody: Result }
					};
					const Status: ControllerCallbackObject = {
						Type: MessageType.STATUS,
						Status: {
							fill: 'green',
							shape: 'dot',
							text: event_NetworkHealDone.nodeStatusName,
							clearTime: 5000
						}
					};
					updateLatestStatus(event_NetworkHealDone.nodeStatusName);
					ControllerNodeIDs.forEach((ID) => {
						controllerNodes[ID](Event);
						controllerNodes[ID](Status);
					});
				}
			);

			// Heal Progress
			self.driverInstance?.controller.on(
				event_HealNetworkProgress.driverName,
				(Progress: ReadonlyMap<number, HealNodeStatus>) => {
					const Timestamp = new Date().getTime();
					const ControllerNodeIDs = Object.keys(controllerNodes);
					const Event: ControllerCallbackObject = {
						Type: MessageType.EVENT,
						Event: { event: event_HealNetworkProgress.redEventName, timestamp: Timestamp, eventBody: Progress }
					};
					const Count = Progress.size;
					const Remain = [...Progress.values()].filter((V) => V === 'pending').length;
					const Completed = Count - Remain;
					const CompletedPercentage = Math.round((100 * Completed) / (Completed + Remain));
					const Status: ControllerCallbackObject = {
						Type: MessageType.STATUS,
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
				}
			);
		};

		// Node callback subscriptions
		const wireNodeEvents = (Node: ZWaveNode) => {
			if (Node.isControllerNode) {
				return;
			}

			// Awake, Live, Dead, Sleep, Ready
			[event_Ready, event_Alive, event_Dead, event_Wake, event_Sleep].forEach((ThisEvent) => {
				Node.on(ThisEvent.driverName, (ThisNode: ZWaveNode) => {
					const Timestamp = new Date().getTime();
					const InterestedDeviceNodes = Object.values(deviceNodes).filter(
						(I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined
					);
					const Event: DeviceCallbackObject = {
						Type: MessageType.EVENT,
						Event: {
							event: ThisEvent.redEventName,
							timestamp: Timestamp,
							nodeId: ThisNode.id,
							nodeName: ThisNode.name,
							nodeLocation: ThisNode.location
						}
					};
					InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
				});
			});

			// Interview Started
			Node.on(event_InterviewStarted.driverName, (ThisNode: ZWaveNode) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_InterviewStarted.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
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
			});

			// Interview Completed
			Node.on(event_InterviewCompleted.driverName, (ThisNode: ZWaveNode) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_InterviewCompleted.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
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
			});

			// Interview Failed
			Node.on(event_InterviewFailed.driverName, (ThisNode: ZWaveNode, Args: NodeInterviewFailedEventArgs) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(controllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_InterviewFailed.redEventName, timestamp: Timestamp, eventBody: Args }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
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
			});

			// Value Notification
			Node.on(event_ValueNotification.driverName, (ThisNode: ZWaveNode, Args: ZWaveNodeValueNotificationArgs) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(deviceNodes).filter(
					(I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined
				);
				const Event: DeviceCallbackObject = {
					Type: MessageType.EVENT,
					Event: {
						event: event_ValueNotification.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: Args
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
			});

			// Value updated
			Node.on(event_ValueUpdated.driverName, (ThisNode: ZWaveNode, Args: ZWaveNodeValueUpdatedArgs) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(deviceNodes).filter(
					(I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined
				);
				const Event: DeviceCallbackObject = {
					Type: MessageType.EVENT,
					Event: {
						event: event_ValueUpdated.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: Args
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
			});

			// Value Added
			Node.on(event_ValueAdded.driverName, (ThisNode: ZWaveNode, Args: ZWaveNodeValueAddedArgs) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(deviceNodes).filter(
					(I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined
				);
				const Event: DeviceCallbackObject = {
					Type: MessageType.EVENT,
					Event: {
						event: event_ValueAdded.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: Args
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
			});

			// Notification
			Node.on(event_Notification.driverName, (ThisNode: ZWaveNode, CC: number, Args: Record<string, any>) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(deviceNodes).filter(
					(I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined
				);
				const Event: DeviceCallbackObject = {
					Type: MessageType.EVENT,
					Event: {
						event: event_Notification.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: { ccId: CC, args: Args }
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
			});
		};

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

		wireDriverEvents();

		self.driverInstance?.on('error', (Err) => {
			console.log(Err);
		});

		self.driverInstance
			.start()
			.catch((e) => {
				self.error(e);
				return;
			})
			.then(() => {
				//
			});
	};

	RED.httpAdmin.get('/zwave-js/ui/global/getports', RED.auth.needsPermission('flows.write'), (_, response) => {
		Driver.enumerateSerialPorts()
			.then((data) => {
				response.json({ callSuccess: true, response: data });
			})
			.catch((Error) => {
				response.json({ callSuccess: false, response: Error.message });
			});
	});

	RED.nodes.registerType('zwavejs-runtime', init, {
		credentials: {
			securityKeys_S0_Legacy: { type: 'text' },
			securityKeys_S2_Unauthenticated: { type: 'text' },
			securityKeys_S2_Authenticated: { type: 'text' },
			securityKeys_S2_AccessControl: { type: 'text' }
		}
	});
};
