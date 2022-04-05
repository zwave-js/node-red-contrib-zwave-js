module.exports = function (RED) {
	const Path = require('path');
	const ModulePackage = require('../package.json');
	const { NodeEventEmitter } = require('./events');
	const ZWaveJS = require('zwave-js');
	const {
		createDefaultTransportFormat,
		CommandClasses,
		ZWaveErrorCodes,
		getCCName
	} = require('@zwave-js/core');
	const Winston = require('winston');
	const { Pin2LogTransport } = require('./Pin2LogTransport');

	class SanitizedEventName {
		constructor(event) {
			this.zwaveName = event;
			this.redName = event.replace(/ /g, '_').toUpperCase();
			this.statusName =
				event.charAt(0).toUpperCase() + event.substr(1).toLowerCase() + '.';
			this.statusNameWithNode = (Node) => {
				return 'Node: ' + Node.id + ' ' + this.statusName;
			};
		}
	}

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
	const event_FirmwareUpdateFinished = new SanitizedEventName(
		'firmware update finished'
	);
	const event_ValueNotification = new SanitizedEventName('value notification');
	const event_Notification = new SanitizedEventName('notification');
	const event_ValueUpdated = new SanitizedEventName('value updated');
	const event_ValueAdded = new SanitizedEventName('value added');
	const event_Wake = new SanitizedEventName('wake up');
	const event_Sleep = new SanitizedEventName('sleep');
	const event_InterviewStarted = new SanitizedEventName('interview started');
	const event_InterviewFailed = new SanitizedEventName('interview failed');
	const event_InterviewCompleted = new SanitizedEventName(
		'interview completed'
	);
	const event_Ready = new SanitizedEventName('ready');
	const event_HealNetworkProgress = new SanitizedEventName(
		'heal network progress'
	);

	const UI = require('./ui/server.js');
	UI.init(RED);

	function Init(config) {
		RED.nodes.createNode(this, config);
		const RedNode = this;

		let Driver;
		let Logger;
		let FileTransport;
		let Pin2Transport;

		let _GrantResolve = undefined;
		let _DSKResolve = undefined;
		let _ClientSideAuth = undefined;

		const MaxDriverAttempts = 3;
		let DriverAttempts = 0;
		const RetryTime = 5000;
		let DriverOptions = {};

		// Log function
		const Log = function (level, label, direction, tag1, msg, tag2) {
			if (Logger !== undefined) {
				const logEntry = {
					direction: '  ',
					message: msg,
					level: level,
					label: label,
					timestamp: new Date().toJSON(),
					multiline: Array.isArray(msg)
				};
				if (direction !== undefined) {
					logEntry.direction = direction === 'IN' ? '« ' : '» ';
				}
				if (tag1 !== undefined) {
					logEntry.primaryTags = tag1;
				}
				if (tag2 !== undefined) {
					logEntry.secondaryTags = tag2;
				}
				Logger.log(logEntry);
			}
		};

		// eslint-disable-next-line no-unused-vars
		let RestoreReadyTimer;
		function RestoreReadyStatus() {
			if (RestoreReadyTimer !== undefined) {
				clearTimeout(RestoreReadyTimer);
				RestoreReadyTimer = undefined;
			}

			RestoreReadyTimer = setTimeout(() => {
				const NotReady = [];
				let AllReady = true;

				Driver.controller.nodes.forEach((N) => {
					if (
						!N.ready ||
						ZWaveJS.InterviewStage[N.interviewStage] !== 'Complete'
					) {
						NotReady.push(N.id);
						AllReady = false;
					}
				});

				if (AllReady) {
					RedNode.status({
						fill: 'green',
						shape: 'dot',
						text: event_AllNodesReady.statusName
					});
					UI.status(event_AllNodesReady.statusName);
				} else {
					RedNode.status({
						fill: 'yellow',
						shape: 'dot',
						text: 'Nodes : ' + NotReady.toString() + ' Not ready.'
					});
					UI.status('Nodes : ' + NotReady.toString() + ' Not ready.');
				}
			}, 5000);
		}

		// Create Logger (if needed)
		if (config.logLevel !== 'none' || config.logLevelPin !== 'none') {
			Logger = Winston.createLogger();
		}

		if (config.logLevel !== 'none') {
			const FileTransportOptions = {
				filename: Path.join(RED.settings.userDir, 'zwave-js.log'),
				format: createDefaultTransportFormat(false, false),
				level: config.logLevel
			};
			if (config.logFile !== undefined && config.logFile.length > 0) {
				FileTransportOptions.filename = config.logFile;
			}
			FileTransport = new Winston.transports.File(FileTransportOptions);
			Logger.add(FileTransport);
		}

		function P2Log(Info) {
			RedNode.send([undefined, { payload: Info }]);
		}

		if (config.logLevelPin !== 'none') {
			const Options = {
				level: config.logLevelPin,
				callback: P2Log
			};
			Pin2Transport = new Pin2LogTransport(Options);
			Logger.add(Pin2Transport);
		}

		RedNode.status({
			fill: 'red',
			shape: 'dot',
			text: 'Starting Z-Wave driver...'
		});
		UI.status('Starting Z-Wave driver...');

		NodeEventEmitter.on('zwjs:node:command', processMessageEvent);
		async function processMessageEvent(MSG) {
			await Input(MSG, undefined, undefined, true);
		}

		DriverOptions = {};

		// Logging
		DriverOptions.logConfig = {};
		if (Logger !== undefined) {
			DriverOptions.logConfig.enabled = true;
			if (
				config.logNodeFilter !== undefined &&
				config.logNodeFilter.length > 0
			) {
				const Nodes = config.logNodeFilter.split(',');
				const NodesArray = [];
				Nodes.forEach((N) => {
					NodesArray.push(parseInt(N));
				});
				DriverOptions.logConfig.nodeFilter = NodesArray;
			}
			DriverOptions.logConfig.transports = [];
			if (FileTransport !== undefined) {
				DriverOptions.logConfig.transports.push(FileTransport);
			}
			if (Pin2Transport !== undefined) {
				DriverOptions.logConfig.transports.push(Pin2Transport);
			}
		} else {
			DriverOptions.logConfig.enabled = false;
		}

		// Code Interview
		if (config.intvwUserCodes !== undefined && config.intvwUserCodes) {
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [interview.queryAllUserCodes]',
				'Enabled'
			);
			DriverOptions.interview = {
				queryAllUserCodes: true
			};
		} else {
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [interview.queryAllUserCodes]',
				'Disabled'
			);
			DriverOptions.interview = {
				queryAllUserCodes: false
			};
		}

		// Optimsitic Value Updates
		if (
			config.disableOptimisticValueUpdate !== undefined &&
			config.disableOptimisticValueUpdate
		) {
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [disableOptimisticValueUpdate]',
				'Enabled'
			);
			DriverOptions.disableOptimisticValueUpdate = true;
		} else {
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [disableOptimisticValueUpdate]',
				'Disabled'
			);
			DriverOptions.disableOptimisticValueUpdate = false;
		}

		// Soft Reset
		if (config.softResetUSB !== undefined && config.softResetUSB) {
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [enableSoftReset]',
				'Enabled'
			);
			DriverOptions.enableSoftReset = true;

			if (
				config.serialAPIStarted !== undefined &&
				config.serialAPIStarted.length > 0
			) {
				Log(
					'debug',
					'NDERED',
					undefined,
					'[options] [timeouts.serialAPIStarted]',
					config.serialAPIStarted
				);
				DriverOptions.timeouts = {};
				DriverOptions.timeouts.serialAPIStarted = parseInt(
					config.serialAPIStarted
				);
			}
		} else {
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [enableSoftReset]',
				'Disabled'
			);
			DriverOptions.enableSoftReset = false;
		}

		DriverOptions.storage = {};

		// Cache Dir
		Log(
			'debug',
			'NDERED',
			undefined,
			'[options] [storage.cacheDir]',
			Path.join(RED.settings.userDir, 'zwave-js-cache')
		);
		DriverOptions.storage.cacheDir = Path.join(
			RED.settings.userDir,
			'zwave-js-cache'
		);

		// Custom  Config Path
		if (
			config.customConfigPath !== undefined &&
			config.customConfigPath.length > 0
		) {
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [storage.deviceConfigPriorityDir]',
				config.customConfigPath
			);
			DriverOptions.storage.deviceConfigPriorityDir = config.customConfigPath;
		}

		// Disk throttle
		if (
			config.valueCacheDiskThrottle !== undefined &&
			config.valueCacheDiskThrottle.length > 0
		) {
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [storage.throttle]',
				config.valueCacheDiskThrottle
			);
			DriverOptions.storage.throttle = config.valueCacheDiskThrottle;
		}

		// Timeout
		if (!DriverOptions.hasOwnProperty('timeouts')) {
			DriverOptions.timeouts = {};
		}
		if (config.ackTimeout !== undefined && config.ackTimeout.length > 0) {
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [timeouts.ack]',
				config.ackTimeout
			);
			DriverOptions.timeouts.ack = parseInt(config.ackTimeout);
		}
		if (
			config.controllerTimeout !== undefined &&
			config.controllerTimeout.length > 0
		) {
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [timeouts.response]',
				config.controllerTimeout
			);
			DriverOptions.timeouts.response = parseInt(config.controllerTimeout);
		}
		if (
			config.sendDataCallback !== undefined &&
			config.sendDataCallback.length > 0
		) {
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [timeouts.sendDataCallback]',
				config.sendDataCallback
			);
			DriverOptions.timeouts.sendDataCallback = parseInt(
				config.sendDataCallback
			);
		}
		if (
			config.sendResponseTimeout !== undefined &&
			config.sendResponseTimeout.length > 0
		) {
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [timeouts.report]',
				config.sendResponseTimeout
			);
			DriverOptions.timeouts.report = parseInt(config.sendResponseTimeout);
		}

		DriverOptions.securityKeys = {};

		const GetKey = (Property, ZWAVEJSName) => {
			if (config[Property] !== undefined && config[Property].length > 0) {
				const Buf = Buffer.from(config[Property], 'hex');
				Log(
					'debug',
					'NDERED',
					undefined,
					'[options] [securityKeys.' + ZWAVEJSName + ']',
					'Encryption key provided',
					'[' + Buf.length + ' bytes]'
				);

				if (Buf.length === 16) {
					DriverOptions.securityKeys[ZWAVEJSName] = Buffer.from(Buf);
				}
			}
		};

		GetKey('encryptionKey', 'S0_Legacy');
		GetKey('encryptionKeyS2U', 'S2_Unauthenticated');
		GetKey('encryptionKeyS2A', 'S2_Authenticated');
		GetKey('encryptionKeyS2AC', 'S2_AccessControl');

		function ShareNodeList() {
			const NodeList = {};

			NodeList['No location'] = [];
			Driver.controller.nodes.forEach((ZWN) => {
				if (ZWN.isControllerNode) {
					return;
				}
				const Node = {
					id: ZWN.id,
					name: ZWN.name !== undefined ? ZWN.name : 'No name',
					location: ZWN.location !== undefined ? ZWN.location : 'No location'
				};
				if (!NodeList.hasOwnProperty(Node.location)) {
					NodeList[Node.location] = [];
				}
				NodeList[Node.location].push(Node);
			});

			UI.upateNodeList(NodeList);
		}

		function NodeCheck(ID, SkipReady) {
			if (Driver.controller.nodes.get(ID) === undefined) {
				const ErrorMSG = 'Node ' + ID + ' does not exist.';
				throw new Error(ErrorMSG);
			}

			if (!SkipReady) {
				if (!Driver.controller.nodes.get(ID).ready) {
					const ErrorMSG =
						'Node ' + ID + ' is not yet ready to receive commands.';
					throw new Error(ErrorMSG);
				}
			}
		}

		function ThrowVirtualNodeLimit() {
			throw new Error(
				'Multicast only supports ValueAPI:setValue and CCAPI set type commands.'
			);
		}

		RedNode.on('close', (removed, done) => {
			const Type = removed ? 'DELETE' : 'RESTART';
			Log(
				'info',
				'NDERED',
				undefined,
				'[SHUTDOWN] [' + Type + ']',
				'Cleaning up...'
			);
			UI.unregister();
			Driver.destroy().then(() => {
				NodeEventEmitter.removeListener(
					'zwjs:node:command',
					processMessageEvent
				);
				if (Logger !== undefined) {
					Logger.clear();
					Logger = undefined;
				}
				if (Pin2Transport !== undefined) {
					Pin2Transport = undefined;
				}
				if (FileTransport !== undefined) {
					FileTransport = undefined;
				}
				if (done) {
					done();
				}
			});
		});

		RedNode.on('input', Input);

		async function Input(msg, send, done, internal) {
			let Type = 'CONTROLLER';
			if (internal !== undefined && internal) {
				Type = 'EVENT';
			}

			Log('debug', 'NDERED', 'IN', '[' + Type + ']', 'Payload received.');

			try {
				const Mode = msg.payload.mode;
				switch (Mode) {
					case 'IEAPI':
						await IEAPI(msg);
						break;
					case 'CCAPI':
						await CCAPI(msg, send);
						break;
					case 'ValueAPI':
						await ValueAPI(msg, send);
						break;
					case 'DriverAPI':
						await DriverAPI(msg, send);
						break;
					case 'ControllerAPI':
						await ControllerAPI(msg, send);
						break;
					case 'AssociationsAPI':
						await AssociationsAPI(msg, send);
						break;
				}

				if (done) {
					done();
				}
			} catch (er) {
				Log('error', 'NDERED', undefined, '[ERROR] [INPUT]', er.message);

				if (done) {
					done(er);
				} else {
					RedNode.error(er);
				}
			}
		}

		function CheckKey(strategy) {
			if (strategy === 2) {
				return;
			}

			const KeyRequirementsCFG = {
				0: [
					'S0_Legacy',
					'S2_Unauthenticated',
					'S2_Authenticated',
					'S2_AccessControl'
				],
				1: [
					'S0_Legacy',
					'S2_Unauthenticated',
					'S2_Authenticated',
					'S2_AccessControl'
				],
				3: ['S0_Legacy'],
				4: ['S2_Unauthenticated', 'S2_Authenticated', 'S2_AccessControl']
			};

			const KeyRequirementsLable = {
				0: ['S0 ', 'S2 Unauth ', 'S2 Auth ', 'S2 Access Ctrl'],
				1: ['S0 ', 'S2 Unauth ', 'S2 Auth ', 'S2 Access Ctrl'],
				3: ['S0'],
				4: ['S2 Unauth ', 'S2 Auth ', 'S2 Access Ctrl']
			};

			const Set = KeyRequirementsCFG[strategy];

			Set.forEach((KR) => {
				if (DriverOptions.securityKeys[KR] === undefined) {
					const Label = KeyRequirementsLable[strategy];
					throw new Error(
						'The chosen inclusion strategy require the following keys to be present: ' +
							Label
					);
				}
			});
		}

		async function IEAPI(msg) {
			const Method = msg.payload.method;
			const Params = msg.payload.params || [];

			const Callbacks = {
				grantSecurityClasses: GrantSecurityClasses,
				validateDSKAndEnterPIN: ValidateDSK,
				abort: Abort
			};

			switch (Method) {
				case 'checkKeyReq':
					CheckKey(Params[0]);
					break;

				case 'unprovisionAllSmartStart':
					const Entries = Driver.controller.getProvisioningEntries();
					for (let i = 0; i < Entries.length; i++) {
						const Entry = Entries[i];
						Driver.controller.unprovisionSmartStartNode(Entry.dsk);
					}
					break;

				case 'unprovisionSmartStartNode':
					Driver.controller.unprovisionSmartStartNode(Params[0]);
					break;

				case 'commitScans':
					Params.forEach((S) => {
						Driver.controller.provisionSmartStartNode(S);
					});
					break;
				case 'beginInclusion':
					CheckKey(Params[0].strategy);
					Params[0].userCallbacks = Callbacks;
					await Driver.controller.beginInclusion(Params[0]);
					break;

				case 'beginExclusion':
					await Driver.controller.beginExclusion(Params[0]);
					break;

				case 'grantClasses':
					Grant(Params[0]);
					break;

				case 'verifyDSK':
					VerifyDSK(Params[0]);
					break;

				case 'replaceNode':
					CheckKey(Params[1].strategy);
					Params[1].userCallbacks = Callbacks;
					await Driver.controller.replaceFailedNode(Params[0], Params[1]);
					break;

				case 'stop':
					const IS = await Driver.controller.stopInclusion();
					const ES = await Driver.controller.stopExclusion();
					if (IS || ES) {
						RestoreReadyStatus();
					}
					if (_GrantResolve !== undefined) {
						_GrantResolve(false);
						_GrantResolve = undefined;
					}
					if (_DSKResolve !== undefined) {
						_DSKResolve(false);
						_DSKResolve = undefined;
					}
					break;
			}
			return;
		}

		function GrantSecurityClasses(_Request) {
			_ClientSideAuth = _Request.clientSideAuth;
			UI.sendEvent('node-inclusion-step', 'grant security', {
				classes: _Request.securityClasses
			});
			return new Promise((res) => {
				_GrantResolve = res;
			});
		}

		function Grant(Classes) {
			_GrantResolve({
				securityClasses: Classes,
				clientSideAuth: _ClientSideAuth
			});
			_GrantResolve = undefined;
		}

		function ValidateDSK(DSK) {
			UI.sendEvent('node-inclusion-step', 'verify dsk', { dsk: DSK });
			return new Promise((res) => {
				_DSKResolve = res;
			});
		}

		function VerifyDSK(Pin) {
			_DSKResolve(Pin);
			_DSKResolve = undefined;
		}

		function Abort() {
			if (_GrantResolve !== undefined) {
				_GrantResolve = undefined;
			}
			if (_DSKResolve !== undefined) {
				_DSKResolve = undefined;
			}
			UI.sendEvent('node-inclusion-step', 'aborted');
		}

		async function ControllerAPI(msg, send) {
			const Method = msg.payload.method;
			const Params = msg.payload.params || [];
			const ReturnNode = { id: '' };

			Log(
				'debug',
				'NDERED',
				'IN',
				undefined,
				printParams('ControllerAPI', undefined, Method, Params)
			);

			let SupportsNN = false;

			switch (Method) {
				case 'abortFirmwareUpdate':
					NodeCheck(Params[0]);
					ReturnNode.id = Params[0];
					await Driver.controller.nodes.get(Params[0]).abortFirmwareUpdate();
					Send(ReturnNode, 'FIRMWARE_UPDATE_ABORTED', undefined, send);
					break;

				case 'beginFirmwareUpdate':
					NodeCheck(Params[0]);
					ReturnNode.id = Params[0];
					const Format = ZWaveJS.guessFirmwareFileFormat(Params[2], Params[3]);
					const Firmware = ZWaveJS.extractFirmware(Params[3], Format);
					await Driver.controller.nodes
						.get(Params[0])
						.beginFirmwareUpdate(Firmware.data, Params[1]);
					Send(ReturnNode, 'FIRMWARE_UPDATE_STARTED', Params[1], send);
					break;

				case 'getRFRegion':
					const RFR = await Driver.controller.getRFRegion();
					Send(undefined, 'CURRENT_RF_REGION', ZWaveJS.RFRegion[RFR], send);
					break;

				case 'setRFRegion':
					await Driver.controller.setRFRegion(ZWaveJS.RFRegion[Params[0]]);
					Send(undefined, 'RF_REGION_SET', Params[0], send);
					break;

				case 'toggleRF':
					await Driver.controller.toggleRF(Params[0]);
					Send(undefined, 'RF_STATUS', Params[0], send);
					break;

				case 'getNodes':
					const Nodes = [];
					Driver.controller.nodes.forEach((N) => {
						Nodes.push({
							nodeId: N.id,
							name: N.name,
							location: N.location,
							status: ZWaveJS.NodeStatus[N.status],
							ready: N.ready,
							interviewStage: ZWaveJS.InterviewStage[N.interviewStage],
							zwavePlusVersion: N.zwavePlusVersion,
							zwavePlusNodeType: N.zwavePlusNodeType,
							zwavePlusRoleType: N.zwavePlusRoleType,
							isListening: N.isListening,
							isFrequentListening: N.isFrequentListening,
							canSleep: N.canSleep,
							isRouting: N.isRouting,
							supportedDataRates: N.supportedDataRates,
							maxDataRate: N.maxDataRate,
							supportsSecurity: N.supportsSecurity,
							isSecure: N.isSecure,
							highestSecurityClass: N.getHighestSecurityClass(),
							protocolVersion: ZWaveJS.ProtocolVersion[N.protocolVersion],
							manufacturerId: N.manufacturerId,
							productId: N.productId,
							productType: N.productType,
							firmwareVersion: N.firmwareVersion,
							deviceConfig: N.deviceConfig,
							isControllerNode: N.isControllerNode,
							supportsBeaming: N.supportsBeaming,
							keepAwake: N.keepAwake,
							powerSource: {
								type: N.supportsCC(CommandClasses.Battery)
									? 'battery'
									: 'mains',
								level: N.getValue({
									commandClass: 128,
									endpoint: 0,
									property: 'level'
								}),
								isLow: N.getValue({
									commandClass: 128,
									endpoint: 0,
									property: 'isLow'
								})
							},
							statistics: N.statistics
						});
					});
					Nodes.sort((A, B) => A.nodeId - B.nodeId);
					Send(undefined, 'NODE_LIST', Nodes, send);
					break;

				case 'keepNodeAwake':
					NodeCheck(Params[0]);
					ReturnNode.id = Params[0];
					Driver.controller.nodes.get(Params[0]).keepAwake = Params[1];
					Send(ReturnNode, 'NODE_KEEP_AWAKE', Params[1], send);
					break;

				case 'getNodeNeighbors':
					NodeCheck(Params[0]);
					const NIDs = await Driver.controller.getNodeNeighbors(Params[0]);
					ReturnNode.id = Params[0];
					Send(ReturnNode, 'NODE_NEIGHBORS', NIDs, send);
					break;

				case 'setNodeName':
					NodeCheck(Params[0]);
					Driver.controller.nodes.get(Params[0]).name = Params[1];
					SupportsNN = Driver.controller.nodes
						.get(Params[0])
						.supportsCC(CommandClasses['Node Naming and Location']);
					if (SupportsNN) {
						await Driver.controller.nodes
							.get(Params[0])
							.commandClasses['Node Naming and Location'].setName(Params[1]);
					}
					ReturnNode.id = Params[0];
					Send(ReturnNode, 'NODE_NAME_SET', Params[1], send);
					ShareNodeList();
					break;

				case 'setNodeLocation':
					NodeCheck(Params[0]);
					Driver.controller.nodes.get(Params[0]).location = Params[1];
					SupportsNN = Driver.controller.nodes
						.get(Params[0])
						.supportsCC(CommandClasses['Node Naming and Location']);
					if (SupportsNN) {
						await Driver.controller.nodes
							.get(Params[0])
							.commandClasses['Node Naming and Location'].setLocation(
								Params[1]
							);
					}
					ReturnNode.id = Params[0];
					Send(ReturnNode, 'NODE_LOCATION_SET', Params[1], send);
					ShareNodeList();
					break;

				case 'refreshInfo':
					NodeCheck(Params[0], true);
					const Stage =
						ZWaveJS.InterviewStage[
							Driver.controller.nodes.get(Params[0]).interviewStage
						];
					if (Stage !== 'Complete') {
						const ErrorMSG =
							'Node ' +
							Params[0] +
							' is already being interviewed. Current interview stage : ' +
							Stage +
							'';
						throw new Error(ErrorMSG);
					} else {
						await Driver.controller.nodes.get(Params[0]).refreshInfo();
					}
					break;

				case 'hardReset':
					await Driver.hardReset();
					Send(undefined, 'CONTROLLER_RESET_COMPLETE', undefined, send);
					break;

				case 'healNode':
					NodeCheck(Params[0]);
					ReturnNode.id = Params[0];
					Send(ReturnNode, 'NODE_HEAL_STARTED', undefined, send);
					RedNode.status({
						fill: 'yellow',
						shape: 'dot',
						text: 'Node Heal Started: ' + Params[0]
					});
					UI.status('Node Heal Started: ' + Params[0]);
					const HealResponse = await Driver.controller.healNode(Params[0]);
					if (HealResponse) {
						RedNode.status({
							fill: 'green',
							shape: 'dot',
							text: 'Node Heal Successful: ' + Params[0]
						});
						UI.status('Node Heal Successful: ' + Params[0]);
					} else {
						RedNode.status({
							fill: 'red',
							shape: 'dot',
							text: 'Node Heal Unsuccessful: ' + Params[0]
						});
						UI.status('Node Heal Unsuccessful: ' + Params[0]);
					}
					Send(
						ReturnNode,
						'NODE_HEAL_FINISHED',
						{ success: HealResponse },
						send
					);
					RestoreReadyStatus();
					break;

				case 'beginHealingNetwork':
					await Driver.controller.beginHealingNetwork();
					Send(undefined, 'NETWORK_HEAL_STARTED', undefined, send);
					RedNode.status({
						fill: 'yellow',
						shape: 'dot',
						text: 'Network Heal Started.'
					});
					UI.status('Network Heal Started.');
					break;

				case 'stopHealingNetwork':
					await Driver.controller.stopHealingNetwork();
					Send(undefined, 'NETWORK_HEAL_STOPPED', undefined, send);
					RedNode.status({
						fill: 'blue',
						shape: 'dot',
						text: 'Network Heal Stopped.'
					});
					UI.status('Network Heal Stopped.');
					RestoreReadyStatus();
					break;

				case 'removeFailedNode':
					await Driver.controller.removeFailedNode(Params[0]);
					break;

				case 'proprietaryFunction':
					const ZWaveMessage = new ZWaveJS.Message(Driver, {
						type: ZWaveJS.MessageType.Request,
						functionType: Params[0],
						payload: Params[1]
					});

					const MessageSettings = {
						priority: ZWaveJS.MessagePriority.Controller,
						supportCheck: false
					};

					await Driver.sendMessage(ZWaveMessage, MessageSettings);
					break;
			}

			return;
		}

		async function ValueAPI(msg, send) {
			const Method = msg.payload.method;
			const Params = msg.payload.params || [];
			const Node = msg.payload.node;
			const Multicast = Array.isArray(Node);

			let ZWaveNode;
			if (Multicast) {
				ZWaveNode = Driver.controller.getMulticastGroup(Node);
			} else {
				NodeCheck(Node);
				ZWaveNode = Driver.controller.nodes.get(Node);
			}

			Log(
				'debug',
				'NDERED',
				'IN',
				'[Node: ' + ZWaveNode.id + ']',
				printParams('ValueAPI', undefined, Method, Params)
			);

			const ReturnNode = { id: ZWaveNode.id };

			switch (Method) {
				case 'getDefinedValueIDs':
					if (Multicast) ThrowVirtualNodeLimit();
					const VIDs = ZWaveNode.getDefinedValueIDs();
					Send(ReturnNode, 'VALUE_ID_LIST', VIDs, send);
					break;

				case 'getValueMetadata':
					if (Multicast) ThrowVirtualNodeLimit();
					const M = ZWaveNode.getValueMetadata(Params[0]);
					const ReturnObjectM = {
						...Params[0],
						metadata: M
					};
					Send(ReturnNode, 'GET_VALUE_METADATA_RESPONSE', ReturnObjectM, send);
					break;

				case 'getValue':
					if (Multicast) ThrowVirtualNodeLimit();
					const V = ZWaveNode.getValue(Params[0]);
					const ReturnObject = {
						...Params[0],
						currentValue: V
					};
					if (msg.isolatedNodeId !== undefined) {
						ReturnNode.targetFlowNode = msg.isolatedNodeId;
						delete msg['isolatedNodeId'];
					}
					Send(ReturnNode, 'GET_VALUE_RESPONSE', ReturnObject, send);
					break;

				case 'setValue':
					if (Params.length > 2) {
						await ZWaveNode.setValue(Params[0], Params[1], Params[2]);
					} else {
						await ZWaveNode.setValue(Params[0], Params[1]);
					}
					break;

				case 'pollValue':
					if (Multicast) ThrowVirtualNodeLimit();
					await ZWaveNode.pollValue(Params[0]);
					break;
			}

			return;
		}

		async function CCAPI(msg, send) {
			const CC = msg.payload.cc;
			const Method = msg.payload.method;
			const Params = msg.payload.params || [];
			const Node = msg.payload.node;
			const Endpoint = msg.payload.endpoint || 0;
			const EnumSelection = msg.payload.enums;
			const ForceUpdate = msg.payload.forceUpdate;
			const Multicast = Array.isArray(Node);
			let IsEventResponse = true;

			let ZWaveNode;
			if (Multicast) {
				ZWaveNode = Driver.controller.getMulticastGroup(Node);
			} else {
				NodeCheck(Node);
				ZWaveNode = Driver.controller.nodes.get(Node);
			}

			Log(
				'debug',
				'NDERED',
				'IN',
				'[Node: ' + ZWaveNode.id + ']',
				printParams('CCAPI', CC, Method, Params)
			);

			if (msg.payload.responseThroughEvent !== undefined) {
				IsEventResponse = msg.payload.responseThroughEvent;
			}

			const ReturnNode = { id: ZWaveNode.id };

			if (EnumSelection !== undefined) {
				const ParamIndexs = Object.keys(EnumSelection);
				ParamIndexs.forEach((PI) => {
					const EnumName = EnumSelection[PI];
					const Enum = ZWaveJS[EnumName];
					Params[PI] = Enum[Params[PI]];
				});
			}

			const Result = await ZWaveNode.getEndpoint(Endpoint).invokeCCAPI(
				CommandClasses[CC],
				Method,
				...Params
			);
			if (!IsEventResponse && ForceUpdate === undefined) {
				Send(ReturnNode, 'VALUE_UPDATED', Result, send);
			}

			if (ForceUpdate !== undefined) {
				if (Multicast) ThrowVirtualNodeLimit();

				const ValueID = {
					commandClass: CommandClasses[CC],
					endpoint: Endpoint
				};
				Object.keys(ForceUpdate).forEach((VIDK) => {
					ValueID[VIDK] = ForceUpdate[VIDK];
				});
				Log(
					'debug',
					'NDERED',
					undefined,
					'[POLL]',
					printForceUpdate(Node, ValueID)
				);
				await ZWaveNode.pollValue(ValueID);
			}

			return;
		}

		async function DriverAPI(msg, send) {
			const Method = msg.payload.method;
			const Params = msg.payload.params || [];

			Log(
				'debug',
				'NDERED',
				'IN',
				undefined,
				printParams('DriverAPI', undefined, Method, Params)
			);

			switch (Method) {
				case 'checkLifelineHealth':
					const NID = Params[0];
					const Rounds = Params[1] || undefined;
					const CallBack = Params[2] || undefined;
					NodeCheck(NID);
					const HCResult = await Driver.controller.nodes
						.get(NID)
						.checkLifelineHealth(Rounds, CallBack);
					Send(
						undefined,
						'HEALTH_CHECK_RESULT',
						{ node: NID, health: HCResult },
						send
					);
					break;

				case 'installConfigUpdate':
					let Success = false;
					const Version = await Driver.checkForConfigUpdates();
					if (Version !== undefined) {
						Success = await Driver.installConfigUpdate();
					}
					Send(
						undefined,
						'DB_UPDATE_RESULT',
						{ installed: Success, version: Version },
						send
					);
					break;

				case 'getNodeStatistics':
					const NS = {};
					if (Params.length < 1) {
						Driver.controller.nodes.forEach((N) => {
							NS[N.id] = N.statistics;
						});
					} else {
						Params.forEach((NID) => {
							const _N = Driver.controller.nodes.get(NID);
							NS[_N.id] = _N.statistics;
						});
					}
					Send(undefined, 'NODE_STATISTICS', NS, send);
					break;

				case 'getControllerStatistics':
					Send(
						undefined,
						'CONTROLER_STATISTICS',
						Driver.controller.statistics,
						send
					);
					break;

				case 'getValueDB':
					const Result = [];
					if (Params.length < 1) {
						Driver.controller.nodes.forEach((N) => {
							Params.push(N.id);
						});
					}
					Params.forEach((NID) => {
						const G = {
							nodeId: NID,
							nodeName: getNodeInfoForPayload(NID, 'name'),
							nodeLocation: getNodeInfoForPayload(NID, 'location'),
							values: []
						};
						const VIDs = Driver.controller.nodes.get(NID).getDefinedValueIDs();
						VIDs.forEach((VID) => {
							const V = Driver.controller.nodes.get(NID).getValue(VID);
							const VI = {
								currentValue: V,
								valueId: VID
							};
							G.values.push(VI);
						});
						Result.push(G);
					});
					Send(undefined, 'VALUE_DB', Result, send);
					break;
			}

			return;
		}

		async function AssociationsAPI(msg, send) {
			const Method = msg.payload.method;
			const Params = msg.payload.params || [];

			Log(
				'debug',
				'NDERED',
				'IN',
				undefined,
				printParams('AssociationsAPI', undefined, Method, Params)
			);

			const ReturnNode = { id: '' };
			let ResultData;
			let PL;
			switch (Method) {
				case 'getAssociationGroups':
					NodeCheck(Params[0].nodeId);
					ResultData = Driver.controller.getAssociationGroups(Params[0]);
					PL = [];
					ResultData.forEach((FV, FK) => {
						const A = {
							GroupID: FK,
							AssociationGroupInfo: FV
						};
						PL.push(A);
					});

					ReturnNode.id = Params[0].nodeId;
					Send(
						ReturnNode,
						'ASSOCIATION_GROUPS',
						{ SourceAddress: Params[0], Groups: PL },
						send
					);
					break;

				case 'getAllAssociationGroups':
					NodeCheck(Params[0]);
					ResultData = Driver.controller.getAllAssociationGroups(Params[0]);
					PL = [];
					ResultData.forEach((FV, FK) => {
						const A = {
							Endpoint: FK,
							Groups: []
						};
						FV.forEach((SV, SK) => {
							const B = {
								GroupID: SK,
								AssociationGroupInfo: SV
							};
							A.Groups.push(B);
						});
						PL.push(A);
					});

					ReturnNode.id = Params[0];
					Send(ReturnNode, 'ALL_ASSOCIATION_GROUPS', PL, send);
					break;

				case 'getAssociations':
					NodeCheck(Params[0].nodeId);
					ResultData = Driver.controller.getAssociations(Params[0]);
					PL = [];
					ResultData.forEach((FV, FK) => {
						const A = {
							GroupID: FK,
							AssociationAddress: []
						};
						FV.forEach((AA) => {
							A.AssociationAddress.push(AA);
						});

						PL.push(A);
					});

					ReturnNode.id = Params[0].nodeId;
					Send(
						ReturnNode,
						'ASSOCIATIONS',
						{ SourceAddress: Params[0], Associations: PL },
						send
					);
					break;

				case 'getAllAssociations':
					NodeCheck(Params[0]);
					ResultData = Driver.controller.getAllAssociations(Params[0]);
					PL = [];
					ResultData.forEach((FV, FK) => {
						const A = {
							AssociationAddress: FK,
							Associations: []
						};
						FV.forEach((SV, SK) => {
							const B = {
								GroupID: SK,
								AssociationAddress: SV
							};
							A.Associations.push(B);
						});
						PL.push(A);
					});

					ReturnNode.id = Params[0];
					Send(ReturnNode, 'ALL_ASSOCIATIONS', PL, send);
					break;

				case 'addAssociations':
					NodeCheck(Params[0].nodeId);
					Params[2].forEach((A) => {
						if (
							!Driver.controller.isAssociationAllowed(Params[0], Params[1], A)
						) {
							const ErrorMSG =
								'Association: Source ' + JSON.stringify(Params[0]);
							+', Group ' +
								Params[1] +
								', Destination ' +
								JSON.stringify(A) +
								' is not allowed.';
							throw new Error(ErrorMSG);
						}
					});
					await Driver.controller.addAssociations(
						Params[0],
						Params[1],
						Params[2]
					);
					ReturnNode.id = Params[0].nodeId;
					Send(ReturnNode, 'ASSOCIATIONS_ADDED', undefined, send);
					break;

				case 'removeAssociations':
					NodeCheck(Params[0].nodeId);
					await Driver.controller.removeAssociations(
						Params[0],
						Params[1],
						Params[2]
					);
					ReturnNode.id = Params[0].nodeId;
					Send(ReturnNode, 'ASSOCIATIONS_REMOVED', undefined, send);
					break;

				case 'removeNodeFromAllAssociations':
					NodeCheck(Params[0]);
					await Driver.controller.removeNodeFromAllAssociations(Params[0]);
					ReturnNode.id = Params[0];
					Send(ReturnNode, 'ALL_ASSOCIATIONS_REMOVED', undefined, send);
					break;
			}

			return;
		}

		function printParams(Mode, CC, Method, Params) {
			const Lines = [];
			if (CC !== undefined) {
				Lines.push(
					'[API: ' + Mode + '] [CC: ' + CC + '] [Method: ' + Method + ']'
				);
			} else {
				Lines.push('[API: ' + Mode + '] [Method: ' + Method + ']');
			}

			if (Params.length > 0) {
				Lines.push('└─[params]');
				let i = 0;
				Params.forEach((P) => {
					if (typeof P === 'object') {
						Lines.push('    ' + (i + ': ') + JSON.stringify(P));
					} else {
						Lines.push('    ' + (i + ': ') + P);
					}
					i++;
				});
			}

			return Lines;
		}

		function printForceUpdate(NID, Value) {
			const Lines = [];
			Lines.push('[Node: ' + NID + ']');
			Lines.push('└─[ValueID]');
			const OBKeys = Object.keys(Value);
			OBKeys.forEach((K) => {
				Lines.push('    ' + (K + ': ') + Value[K]);
			});

			return Lines;
		}

		function getNodeInfoForPayload(NodeID, Property) {
			try {
				const Prop = Driver.controller.nodes.get(parseInt(NodeID))[Property];
				return Prop;
			} catch (err) {
				return undefined;
			}
		}

		function buildNormalized(Payload) {
			try {
				const VID = {
					commandClass: Payload.object.commandClass,
					endpoint: Payload.object.endpoint,
					property: Payload.object.property,
					propertyKey: Payload.object.propertyKey
				};

				const CCName = getCCName(Payload.object.commandClass);

				const Meta = Driver.controller.nodes
					.get(Payload.node)
					.getValueMetadata(VID);

				if (Meta === undefined) {
					return undefined;
				}

				const NO = {};

				NO.commandClass = `0x${VID.commandClass
					.toString(16)
					.padStart(2, '0')} - ${CCName}`;

				if (Payload.object.hasOwnProperty('currentValue')) {
					NO.type =
						Meta.states?.[Payload.object.currentValue] === undefined
							? Meta.type
							: typeof Meta.states[Payload.object.currentValue];
					NO.currentValue =
						Meta.states?.[Payload.object.currentValue] ??
						Payload.object.currentValue;
				} else {
					NO.type =
						Meta.states?.[Payload.object.newValue] === undefined
							? Meta.type
							: typeof Meta.states[Payload.object.newValue];
					NO.newValue =
						Meta.states?.[Payload.object.newValue] ?? Payload.object.newValue;
					NO.prevValue =
						Meta.states?.[Payload.object.prevValue] ?? Payload.object.prevValue;
				}

				NO.label = Meta.label;

				if (Meta.unit !== undefined) NO.unit = Meta.unit;
				if (Meta.description !== undefined) NO.description = Meta.description;

				return NO;
			} catch (Err) {
				return undefined;
			}
		}

		function Send(Node, Subject, Value, send) {
			const PL = {};

			let IsolatedNodeId;

			if (Node !== undefined) {
				PL.node = Node.id;
				IsolatedNodeId = Node.targetFlowNode || undefined;
			}

			if (Node !== undefined) {
				const N = getNodeInfoForPayload(Node.id, 'name');
				if (N !== undefined) {
					PL.nodeName = N;
				}
				const L = getNodeInfoForPayload(Node.id, 'location');
				if (L !== undefined) {
					PL.nodeLocation = L;
				}
			}
			PL.event = Subject;
			PL.timestamp = new Date().getTime();
			if (Value !== undefined) {
				PL.object = Value;
			}

			let _Subject = '';
			if (Node !== undefined) {
				_Subject = '[Node: ' + Node.id + '] [' + Subject + ']';
			} else {
				_Subject = '[' + Subject + ']';
			}

			switch (PL.event) {
				case 'VALUE_UPDATED':
				case 'VALUE_NOTIFICATION':
				case 'GET_VALUE_RESPONSE':
					PL.normalizedObject = buildNormalized(PL);
					break;
			}
			Log('debug', 'NDERED', 'OUT', _Subject, '[DIRECT] Forwarding payload...');
			if (send) {
				send({ payload: PL });
			} else {
				RedNode.send({ payload: PL });
			}

			const AllowedSubjectsForDNs = [
				'VALUE_NOTIFICATION',
				'NOTIFICATION',
				'VALUE_UPDATED',
				'SLEEP',
				'WAKE_UP',
				'VALUE_ID_LIST',
				'GET_VALUE_RESPONSE',
				'GET_VALUE_METADATA_RESPONSE'
			];

			if (AllowedSubjectsForDNs.includes(Subject)) {
				if (IsolatedNodeId !== undefined) {
					Log(
						'debug',
						'NDERED',
						'OUT',
						_Subject,
						'[ISOLATED] [' + IsolatedNodeId + '] Forwarding payload...'
					);
					NodeEventEmitter.emit(`zwjs:node:event:isloated:${IsolatedNodeId}`, {
						payload: PL
					});
				} else {
					Log(
						'debug',
						'NDERED',
						'OUT',
						_Subject,
						'[EVENT] Forwarding payload...'
					);
					NodeEventEmitter.emit('zwjs:node:event:all', { payload: PL });
					NodeEventEmitter.emit('zwjs:node:event:' + Node.id, { payload: PL });
				}
			}
		}

		InitDriver();
		StartDriver();

		function InitDriver() {
			DriverAttempts++;
			try {
				Log('info', 'NDERED', undefined, undefined, 'Initializing driver...');
				Driver = new ZWaveJS.Driver(config.serialPort, DriverOptions);

				if (
					config.sendUsageStatistics !== undefined &&
					config.sendUsageStatistics
				) {
					Log('info', 'NDERED', undefined, '[TELEMETRY]', 'Enabling...');
					Driver.enableStatistics({
						applicationName: ModulePackage.name,
						applicationVersion: ModulePackage.version
					});
				} else {
					Log('info', 'NDERED', undefined, '[TELEMETRY]', 'Disabling...');
					Driver.disableStatistics();
				}
			} catch (e) {
				Log('error', 'NDERED', undefined, '[ERROR] [INIT]', e.message);
				RedNode.error(e);
				return;
			}

			WireDriverEvents();
			UI.unregister();
			UI.register(Driver, Input);
		}

		function WireDriverEvents() {
			Driver.on('error', (e) => {
				if (e.code === ZWaveErrorCodes.Driver_Failed) {
					if (DriverAttempts >= MaxDriverAttempts) {
						Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
						RedNode.error(e);
					} else {
						Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
						Log(
							'debug',
							'NDERED',
							undefined,
							undefined,
							'Will retry in ' +
								RetryTime +
								'ms. Attempted: ' +
								DriverAttempts +
								', Max: ' +
								MaxDriverAttempts
						);
						RedNode.error(
							new Error(
								'Driver Failed: Will retry in ' +
									RetryTime +
									'ms. Attempted: ' +
									DriverAttempts +
									', Max: ' +
									MaxDriverAttempts
							)
						);
						InitDriver();
						setTimeout(StartDriver, RetryTime);
					}
				} else {
					Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
					RedNode.error(e);
				}
			});

			// All nodes ready
			Driver.on(event_AllNodesReady.zwaveName, () => {
				RedNode.status({
					fill: 'green',
					shape: 'dot',
					text: event_AllNodesReady.statusName
				});
				UI.status(event_AllNodesReady.statusName);
				Send(undefined, event_AllNodesReady.redName);
			});

			// driver ready
			Driver.once(event_DriverReady.zwaveName, () => {
				DriverAttempts = 0;

				RedNode.status({
					fill: 'yellow',
					shape: 'dot',
					text: 'Initializing network...'
				});
				UI.status('Initializing network...');

				// Add, Remove
				Driver.controller.on(event_NodeAdded.zwaveName, (N) => {
					ShareNodeList();
					WireNodeEvents(N);
					Send(N, event_NodeAdded.redName);
					Send(N, event_InterviewStarted.redName);
					RedNode.status({
						fill: 'yellow',
						shape: 'dot',
						text: event_InterviewStarted.statusNameWithNode(N)
					});
					UI.status(event_InterviewStarted.statusNameWithNode(N));
				});

				Driver.controller.on(event_NodeRemoved.zwaveName, (N) => {
					ShareNodeList();
					Send(N, event_NodeRemoved.redName);
				});

				// Include
				Driver.controller.on(event_InclusionStarted.zwaveName, (Secure) => {
					Send(undefined, event_InclusionStarted.redName, {
						isSecureInclude: Secure
					});
					RedNode.status({
						fill: 'yellow',
						shape: 'dot',
						text: event_InclusionStarted.statusName
					});
					UI.status(event_InclusionStarted.statusName);
				});
				Driver.controller.on(event_InclusionFailed.zwaveName, () => {
					Send(undefined, event_InclusionFailed.redName);
					RedNode.status({
						fill: 'red',
						shape: 'dot',
						text: event_InclusionFailed.statusName
					});
					UI.status(event_InclusionFailed.statusName);
					RestoreReadyStatus();
				});
				Driver.controller.on(event_InclusionStopped.zwaveName, () => {
					Send(undefined, event_InclusionStopped.redName);
					RedNode.status({
						fill: 'green',
						shape: 'dot',
						text: event_InclusionStopped.statusName
					});
					UI.status(event_InclusionStopped.statusName);
				});

				// Exclusion
				Driver.controller.on(event_ExclusionStarted.zwaveName, () => {
					Send(undefined, event_ExclusionStarted.redName);
					RedNode.status({
						fill: 'yellow',
						shape: 'dot',
						text: event_ExclusionStarted.statusName
					});
					UI.status(event_ExclusionStarted.statusName);
				});
				Driver.controller.on(event_ExclusionFailed.zwaveName, () => {
					Send(undefined, event_ExclusionFailed.redName);
					RedNode.status({
						fill: 'red',
						shape: 'dot',
						text: event_ExclusionFailed.statusName
					});
					UI.status(event_ExclusionFailed.statusName);
					RestoreReadyStatus();
				});
				Driver.controller.on(event_ExclusionStopped.zwaveName, () => {
					Send(undefined, event_ExclusionStopped.redName);
					RedNode.status({
						fill: 'green',
						shape: 'dot',
						text: event_ExclusionStopped.statusName
					});
					UI.status(event_ExclusionStopped.statusName);
					RestoreReadyStatus();
				});

				// Heal
				Driver.controller.on(event_NetworkHealDone.zwaveName, () => {
					Send(undefined, event_NetworkHealDone.redName, {
						Successful: Heal_Done,
						Failed: Heal_Failed,
						Skipped: Heal_Skipped
					});
					RedNode.status({
						fill: 'green',
						shape: 'dot',
						text: event_NetworkHealDone.statusName
					});
					UI.status(event_NetworkHealDone.statusName);
					RestoreReadyStatus();
				});

				const Heal_Pending = [];
				const Heal_Done = [];
				const Heal_Failed = [];
				const Heal_Skipped = [];

				Driver.controller.on(event_HealNetworkProgress.zwaveName, (P) => {
					Heal_Pending.length = 0;
					Heal_Done.length = 0;
					Heal_Failed.length = 0;
					Heal_Skipped.length = 0;

					P.forEach((V, K) => {
						switch (V) {
							case 'pending':
								Heal_Pending.push(K);
								break;
							case 'done':
								Heal_Done.push(K);
								break;
							case 'failed':
								Heal_Failed.push(K);
								break;
							case 'skipped':
								Heal_Skipped.push(K);
								break;
						}
					});

					const Processed =
						Heal_Done.length + Heal_Failed.length + Heal_Skipped.length;
					const Remain = Heal_Pending.length;

					const Completed = (100 * Processed) / (Processed + Remain);

					RedNode.status({
						fill: 'yellow',
						shape: 'dot',
						text:
							'Healing network ' +
							Math.round(Completed) +
							'%, Skipped:[' +
							Heal_Skipped +
							'], Failed:[' +
							Heal_Failed +
							']'
					});

					UI.status(
						'Healing network ' +
							Math.round(Completed) +
							'%, Skipped:[' +
							Heal_Skipped +
							'], Failed:[' +
							Heal_Failed +
							']'
					);
				});

				ShareNodeList();

				Driver.controller.nodes.forEach((ZWN) => {
					WireNodeEvents(ZWN);
				});
			});
		}

		function WireNodeEvents(Node) {
			Node.once(event_Ready.zwaveName, (N) => {
				if (N.isControllerNode) {
					return;
				}

				Node.on(event_FirmwareUpdateFinished.zwaveName, (N, S) => {
					Send(N, event_FirmwareUpdateFinished.redName, S);
				});

				Node.on(event_ValueNotification.zwaveName, (N, VL) => {
					Send(N, event_ValueNotification.redName, VL);
				});

				Node.on(event_Notification.zwaveName, (N, CC, ARGS) => {
					const OBJ = {
						ccId: CC,
						args: ARGS
					};
					Send(N, event_Notification.redName, OBJ);
				});

				Node.on(event_ValueUpdated.zwaveName, (N, VL) => {
					Send(N, event_ValueUpdated.redName, VL);
				});

				Node.on(event_ValueAdded.zwaveName, (N, VL) => {
					Send(N, 'VALUE_UPDATED', VL); // we dont differentiate between added, update - cant see the need.
				});

				Node.on(event_Wake.zwaveName, (N) => {
					Send(N, event_Wake.redName);
				});

				Node.on(event_Sleep.zwaveName, (N) => {
					Send(N, event_Sleep.redName);
				});
			});

			Node.on(event_InterviewStarted.zwaveName, (N) => {
				Send(N, event_InterviewStarted.redName);
				RedNode.status({
					fill: 'yellow',
					shape: 'dot',
					text: event_InterviewStarted.statusNameWithNode(N)
				});
				UI.status(event_InterviewStarted.statusNameWithNode(N));
			});

			Node.on(event_InterviewFailed.zwaveName, (N, Er) => {
				if (Er.isFinal) {
					Send(N, event_InterviewFailed.redName, Er);
					RedNode.status({
						fill: 'red',
						shape: 'dot',
						text: event_InterviewFailed.statusNameWithNode(N)
					});
					UI.status(event_InterviewFailed.statusNameWithNode(N));
					RestoreReadyStatus();
				}
			});

			Node.on(event_InterviewCompleted.zwaveName, (N) => {
				Send(N, event_InterviewCompleted.redName);
				RedNode.status({
					fill: 'green',
					shape: 'dot',
					text: event_InterviewCompleted.statusNameWithNode(N)
				});
				UI.status(event_InterviewCompleted.statusNameWithNode(N));
				RestoreReadyStatus();
			});
		}

		function StartDriver() {
			Log('info', 'NDERED', undefined, undefined, 'Starting driver...');
			Driver.start()
				.catch((e) => {
					if (e.code === ZWaveErrorCodes.Driver_Failed) {
						if (DriverAttempts >= MaxDriverAttempts) {
							Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
							RedNode.error(e);
						} else {
							Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
							Log(
								'debug',
								'NDERED',
								undefined,
								undefined,
								'Will retry in ' +
									RetryTime +
									'ms. Attempted: ' +
									DriverAttempts +
									', Max: ' +
									MaxDriverAttempts
							);
							RedNode.error(
								new Error(
									'Driver failed: Will retry in ' +
										RetryTime +
										'ms. Attempted: ' +
										DriverAttempts +
										', Max: ' +
										MaxDriverAttempts
								)
							);
							InitDriver();
							setTimeout(StartDriver, RetryTime);
						}
					} else {
						Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
						RedNode.error(e);
					}
				})
				.then(() => {
					// now what - just sit and wait.
				});
		}
	}

	RED.nodes.registerType('zwave-js', Init);
};
