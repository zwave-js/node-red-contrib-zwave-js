module.exports = function (RED) {
	const Path = require('path');
	const ModulePackage = require('../package.json');
	const { NodeEventEmitter } = require('./events');
	const ZWaveJS = require('zwave-js');
	const { UIServer, SetupGlobals } = require('./ui/server.js');
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
	const event_NetworkHealDone = new SanitizedEventName('rebuild routes done');
	const event_FirmwareUpdateFinished = new SanitizedEventName(
		'firmware update finished'
	);
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
	const event_InterviewCompleted = new SanitizedEventName(
		'interview completed'
	);
	const event_Ready = new SanitizedEventName('ready');
	const event_HealNetworkProgress = new SanitizedEventName(
		'rebuild routes progress'
	);
	const FWK =
		'127c49b6f2928a6579e82ecab64a83fc94a6436f03d5cb670b8ac44412687b75f0667843';

	SetupGlobals(RED);

	function Init(config) {
		RED.nodes.createNode(this, config);
		const RedNode = this;

		const NetworkIdentifier = parseInt(config.networkIdentifier || 1);
		let UI = new UIServer(RED, NetworkIdentifier);
		let Driver;
		let Logger;
		let FileTransport;
		let Pin2Transport;

		let _GrantResolve = undefined;
		let _DSKResolve = undefined;
		let _ClientSideAuth = undefined;

		let RecoveryTimer = undefined;
		let CanRecover = false;
		const RecoverDriver = (Seconds) => {
			if (RecoveryTimer !== undefined) {
				clearTimeout(RecoveryTimer);
				RecoveryTimer = undefined;
			}

			EmitRecoveryEvent(`Recovery Scheduled (${Seconds}s)`);
			RecoveryTimer = setTimeout(() => {
				EmitRecoveryEvent('Attempting Recovery');
				AttemptRecovery();
			}, Seconds * 1000);
		};

		function EmitRecoveryEvent(Event) {
			SetFlowNodeStatus({
				fill: 'red',
				shape: 'dot',
				text: 'Watchdog: ' + Event
			});

			UI.Status('Watchdog: ' + Event);
			Send(undefined, 'WATCHDOG', { status: Event });
		}

		function AttemptRecovery() {
			Log(
				'info',
				'NDERED',
				undefined,
				'[SHUTDOWN] [WATCHDOG-RECOVERY]',
				'Cleaning up...'
			);
			Driver.destroy().then(() => {
				InitDriver();
				StartDriver();
			});
		}

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

		function SetFlowNodeStatus(Status) {
			Status.text = `[Net: ${NetworkIdentifier}] ${Status.text}`;
			RedNode.status(Status);
		}

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
					SetFlowNodeStatus({
						fill: 'green',
						shape: 'dot',
						text: event_AllNodesReady.statusName
					});
					UI.Status(event_AllNodesReady.statusName);
				} else {
					SetFlowNodeStatus({
						fill: 'yellow',
						shape: 'dot',
						text: 'Nodes : ' + NotReady.toString() + ' Not ready.'
					});
					UI.Status('Nodes : ' + NotReady.toString() + ' Not ready.');
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

		SetFlowNodeStatus({
			fill: 'red',
			shape: 'dot',
			text: 'Starting Z-Wave driver...'
		});
		UI.Status('Starting Z-Wave driver...');

		NodeEventEmitter.on(
			`zwjs:${NetworkIdentifier}:node:command`,
			processMessageEvent
		);
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

		// S2 Callbacks
		DriverOptions.inclusionUserCallbacks = {
			grantSecurityClasses: GrantSecurityClasses,
			validateDSKAndEnterPIN: ValidateDSK,
			abort: Abort
		};

		// Scales
		DriverOptions.preferences = {
			scales: { temperature: 0x00, humidity: 0x00 }
		};
		if (config.scalesTemp !== undefined) {
			DriverOptions.preferences.scales.temperature = parseInt(
				config.scalesTemp
			);
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [preferences.scales.temperature]',
				config.scalesTemp
			);
		}
		if (config.scalesHumidity !== undefined) {
			DriverOptions.preferences.scales.humidity = parseInt(
				config.scalesHumidity
			);
			Log(
				'debug',
				'NDERED',
				undefined,
				'[options] [preferences.scales.humidity]',
				config.scalesHumidity
			);
		}

		// License Keys
		DriverOptions.apiKeys = {};
		if (config.FWlicenseKey !== undefined && config.FWlicenseKey.length > 0) {
			if (config.FWlicenseKey.toUpperCase() !== 'NON-COMMERCIAL') {
				DriverOptions.apiKeys.firmwareUpdateService = config.FWlicenseKey;
				Log(
					'debug',
					'NDERED',
					undefined,
					'[FWUS]',
					'Commercial license applied'
				);
			} else {
				DriverOptions.apiKeys.firmwareUpdateService = FWK;
				Log(
					'debug',
					'NDERED',
					undefined,
					'[FWUS]',
					'Open source license applied'
				);
			}
		} else {
			Log(
				'debug',
				'NDERED',
				undefined,
				'[FWUS]',
				'No key provided - Service may fail!'
			);
		}

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

			UI.UpateNodeList(NodeList);
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
			if (RecoveryTimer !== undefined) {
				clearTimeout(RecoveryTimer);
				RecoveryTimer = undefined;
			}
			CanRecover = false;
			UI.Unregister(false);
			UI = undefined;
			Driver.destroy().then(() => {
				NodeEventEmitter.removeListener(
					`zwjs:${NetworkIdentifier}:node:command`,
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
				Driver = undefined;
				if (done) {
					done();
				}
			});
		});

		RedNode.on('input', Input);

		const Convert = (msg) => {
			if (msg.payload.cmd) {
				const CMD = msg.payload.cmd;
				const CMDProp = msg.payload.cmdProperties || {};
				switch (CMD.api) {
					case 'DRIVER':
						msg.payload = {
							mode: 'DriverAPI',
							method: CMD.method,
							params: CMDProp.args
						};
						break;

					case 'ASSOCIATIONS':
						msg.payload = {
							mode: 'AssociationsAPI',
							method: CMD.method,
							params: CMDProp.args
						};
						break;

					case 'CONTROLLER':
						msg.payload = {
							mode: 'ControllerAPI',
							method: CMD.method,
							params: CMDProp.args
						};
						break;

					case 'VALUE':
						msg.payload = {
							mode: 'ValueAPI',
							method: CMD.method,
							node: CMDProp.nodeId
						};
						msg.payload.params = [];

						msg.payload.params.push(CMDProp.valueId);

						if (CMD.method === 'setValue') {
							msg.payload.params.push(CMDProp.value);
							if (CMDProp.setValueOptions) {
								msg.payload.params.push(CMDProp.setValueOptions);
							}
						}
						break;

					case 'CC':
						msg.payload = {
							mode: 'CCAPI',
							cc: CMDProp.commandClass,
							method: CMDProp.method,
							node: CMDProp.nodeId,
							endpoint: CMDProp.endpoint,
							params: CMDProp.args,
							responseThroughEvent: msg.payload.responseThroughEvent,
							forceUpdate: msg.payload.forceUpdate
						};

						break;
				}
			}

			return msg;
		};

		async function Input(msg, send, done, internal) {
			// For my own sanity, i'll convert the new format back to old format if its being used, as this will be much easier during the transition phase
			msg = Convert(msg);

			let Type = 'CONTROLLER';
			if (internal !== undefined && internal) {
				Type = 'EVENT';
			}

			Log('debug', 'NDERED', 'IN', '[' + Type + ']', 'Payload received.');

			try {
				const Mode = msg.payload.mode;
				switch (Mode) {
					case 'IEAPI':
						await IEAPI(msg, send);
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

		async function IEAPI(msg, send) {
			const Method = msg.payload.method;
			const Params = msg.payload.params || [];

			switch (Method) {
				case 'checkKeyReq':
					try {
						CheckKey(Params[0]);
						Send(undefined, 'KEY_CHECK_RESULT', { ok: true }, send);
					} catch (err) {
						Send(
							undefined,
							'KEY_CHECK_RESULT',
							{ ok: false, message: err.message },
							send
						);
					}

					break;

				case 'unprovisionAllSmartStart':
					const Entries = Driver.controller.getProvisioningEntries();
					for (let i = 0; i < Entries.length; i++) {
						const Entry = Entries[i];
						Driver.controller.unprovisionSmartStartNode(Entry.dsk);
					}
					Send(
						undefined,
						'ACTION_DONE',
						{ api: arguments.callee.name, method: Method },
						send
					);
					break;

				case 'unprovisionSmartStartNode':
					Driver.controller.unprovisionSmartStartNode(Params[0]);
					Send(
						undefined,
						'ACTION_DONE',
						{ api: arguments.callee.name, method: Method },
						send
					);
					break;

				case 'commitScans':
					Params.forEach((S) => {
						Driver.controller.provisionSmartStartNode(S);
					});
					Send(
						undefined,
						'ACTION_DONE',
						{ api: arguments.callee.name, method: Method },
						send
					);
					break;

				case 'beginInclusion':
					await Driver.controller.beginInclusion(Params[0]);
					Send(
						undefined,
						'ACTION_DONE',
						{ api: arguments.callee.name, method: Method },
						send
					);
					break;

				case 'beginExclusion':
					const ExOptions = {
						strategy: ZWaveJS.ExclusionStrategy.ExcludeOnly
					};
					if (Params[0]) {
						ExOptions.strategy = ZWaveJS.ExclusionStrategy.Unprovision;
					}
					await Driver.controller.beginExclusion(ExOptions);
					Send(
						undefined,
						'ACTION_DONE',
						{ api: arguments.callee.name, method: Method },
						send
					);
					break;

				case 'grantClasses':
					Grant(Params[0]);
					Send(
						undefined,
						'ACTION_DONE',
						{ api: arguments.callee.name, method: Method },
						send
					);
					break;

				case 'verifyDSK':
					VerifyDSK(Params[0]);
					Send(
						undefined,
						'ACTION_DONE',
						{ api: arguments.callee.name, method: Method },
						send
					);
					break;

				case 'replaceFailedNode':
					await Driver.controller.replaceFailedNode(Params[0], Params[1]);
					Send(
						undefined,
						'ACTION_DONE',
						{ api: arguments.callee.name, method: Method },
						send
					);
					break;

				case 'stopIE':
					const IS = await Driver.controller.stopInclusion();
					const ES = await Driver.controller.stopExclusion();
					Send(
						undefined,
						'ACTION_DONE',
						{ api: arguments.callee.name, method: Method },
						send
					);
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
			UI.SendEvent('node-inclusion-step', 'grant security', {
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
			UI.SendEvent('node-inclusion-step', 'verify dsk', { dsk: DSK });
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
			UI.SendEvent('node-inclusion-step', 'aborted');
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
			let Result;

			switch (Method) {
				case 'getAvailableFirmwareUpdates':
					NodeCheck(Params[0]);
					ReturnNode.id = Params[0];
					const FWU = await Driver.controller.getAvailableFirmwareUpdates(
						Params[0]
					);
					Send(ReturnNode, 'FIRMWARE_UPDATE_CHECK_RESULT', FWU, send);
					break;

				case 'firmwareUpdateOTA':
					NodeCheck(Params[0]);
					ReturnNode.id = Params[0];
					await Driver.controller.firmwareUpdateOTA(Params[0], Params[1]);
					Send(ReturnNode, 'FIRMWARE_UPDATE_STARTED', Params[1], send);
					break;

				case 'restoreNVM':
					Result = await Driver.controller.restoreNVM(
						Params[0],
						Params[1],
						Params[2]
					);
					Send(undefined, 'NVM_RESTORE_DONE', Result, send);
					break;

				case 'backupNVMRaw':
					const Data = await Driver.controller.backupNVMRaw(Params[0]);
					Send(undefined, 'NVM_BACKUP', Data, send);
					break;

				case 'abortFirmwareUpdate':
					NodeCheck(Params[0]);
					ReturnNode.id = Params[0];
					await Driver.controller.nodes.get(Params[0]).abortFirmwareUpdate();
					Send(ReturnNode, 'FIRMWARE_UPDATE_ABORTED', undefined, send);
					break;

				case 'updateFirmware':
					NodeCheck(Params[0]);
					ReturnNode.id = Params[0];
					const Format = ZWaveJS.guessFirmwareFileFormat(Params[2], Params[3]);
					const Firmware = ZWaveJS.extractFirmware(Params[3], Format);
					const Package = {
						data: Firmware.data,
						firmwareTarget: Params[1]
					};

					await Driver.controller.nodes
						.get(Params[0])
						.updateFirmware([Package]);
					Send(ReturnNode, 'FIRMWARE_UPDATE_STARTED', Params[1], send);
					break;

				case 'getRFRegion':
					const RFR = await Driver.controller.getRFRegion();
					Send(undefined, 'CURRENT_RF_REGION', RFR, send);
					break;

				case 'setRFRegion':
					Result = await Driver.controller.setRFRegion(Params[0]);
					Send(
						undefined,
						'RF_REGION_SET_RESULT',
						{ targetRegion: Params[0], success: Result },
						send
					);
					break;

				case 'setPowerlevel':
					Result = await Driver.controller.setPowerlevel(Params[0], Params[1]);
					Send(
						undefined,
						'CONTROLLER_POWER_LEVEL_SET_RESULT',
						{
							targetLevels: { powerlevel: Params[0], measured0dBm: Params[1] },
							success: Result
						},
						send
					);
					break;

				case 'getPowerlevel':
					Result = await Driver.controller.getPowerlevel();
					Send(undefined, 'CONTROLLER_POWER_LEVEL', Result, send);
					break;

				case 'toggleRF':
					Result = await Driver.controller.toggleRF(Params[0]);
					Send(
						undefined,
						'RF_STATUS_SET_RESULT',
						{ targetStatus: Params[0], success: Result },
						send
					);
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
							lastSeen: new Date(N.lastSeen).getTime(),
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
							statistics: N.isControllerNode
								? Driver.controller.statistics
								: N.statistics
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
						Send(
							undefined,
							'ACTION_DONE',
							{ api: arguments.callee.name, method: Method },
							send
						);
					}
					break;

				case 'hardReset':
					await Driver.hardReset();
					Send(undefined, 'CONTROLLER_RESET_COMPLETE', undefined, send);
					break;

				case 'rebuildNodeRoutes':
					NodeCheck(Params[0]);
					ReturnNode.id = Params[0];
					Send(ReturnNode, 'NODE_HEAL_STARTED', undefined, send);
					SetFlowNodeStatus({
						fill: 'yellow',
						shape: 'dot',
						text: 'Rebuild Node Routes Started: ' + Params[0]
					});
					UI.Status('Rebuild Node Routes Started: ' + Params[0]);
					const HealResponse = await Driver.controller.rebuildNodeRoutes(
						Params[0]
					);
					if (HealResponse) {
						SetFlowNodeStatus({
							fill: 'green',
							shape: 'dot',
							text: 'Rebuild Node Routes Successful: ' + Params[0]
						});
						UI.Status('Rebuild Node Routes Successful ' + Params[0]);
					} else {
						SetFlowNodeStatus({
							fill: 'red',
							shape: 'dot',
							text: 'Rebuild Node Routes Unsuccessful: ' + Params[0]
						});
						UI.Status('Rebuild Node Routes Unsuccessful: ' + Params[0]);
					}
					Send(
						ReturnNode,
						'NODE_HEAL_FINISHED',
						{ success: HealResponse },
						send
					);
					RestoreReadyStatus();
					break;

				case 'beginRebuildingRoutes':
					await Driver.controller.beginRebuildingRoutes();
					Send(undefined, 'NETWORK_HEAL_STARTED', undefined, send);
					SetFlowNodeStatus({
						fill: 'yellow',
						shape: 'dot',
						text: 'Route Rebuilding Started.'
					});
					UI.Status('Route Rebuilding Started.');
					break;

				case 'stopRebuildingRoutes':
					await Driver.controller.stopRebuildingRoutes();
					Send(undefined, 'NETWORK_HEAL_STOPPED', undefined, send);
					SetFlowNodeStatus({
						fill: 'blue',
						shape: 'dot',
						text: 'Route Rebuilding Stopped.'
					});
					UI.Status('Route Rebuilding Stopped.');
					RestoreReadyStatus();
					break;

				case 'removeFailedNode':
					await Driver.controller.removeFailedNode(Params[0]);
					Send(
						undefined,
						'ACTION_DONE',
						{ api: arguments.callee.name, method: Method },
						send
					);
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
					Send(
						undefined,
						'ACTION_DONE',
						{ api: arguments.callee.name, method: Method },
						send
					);
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
				case 'getValueTimestamp':
					if (Multicast) ThrowVirtualNodeLimit();
					const TS = ZWaveNode.getValueTimestamp(Params[0]);
					Send(ReturnNode, 'VALUE_TIMESTAMP', TS, send);
					break;

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
					ReturnObject.normalizedObject = buildNormalized(
						ReturnObject,
						ReturnNode.id
					);

					if (msg.isolatedNodeId !== undefined) {
						ReturnNode.targetFlowNode = msg.isolatedNodeId;
						delete msg['isolatedNodeId'];
					}
					Send(ReturnNode, 'GET_VALUE_RESPONSE', ReturnObject, send);
					break;

				case 'setValue':
					await ZWaveNode.setValue(...Params);
					Send(
						undefined,
						'ACTION_DONE',
						{ api: arguments.callee.name, method: Method },
						send
					);
					break;

				case 'pollValue':
					if (Multicast) ThrowVirtualNodeLimit();
					await ZWaveNode.pollValue(Params[0]);
					Send(
						undefined,
						'ACTION_DONE',
						{ api: arguments.callee.name, method: Method },
						send
					);
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
			} else {
				Send(
					undefined,
					'ACTION_DONE',
					{ api: arguments.callee.name, method: Method },
					send
				);
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
				case 'getLastEvents':
					const PL = [];
					Driver.controller.nodes.forEach((N) => {
						if (N.isControllerNode) {
							return;
						}
						const I = {
							node: N.id,
							nodeName: getNodeInfoForPayload(N.id, 'name'),
							nodeLocation: getNodeInfoForPayload(N.id, 'location'),
							timestamp: N.ZWNR_lastSeen || 0,
							event: N.ZWNR_lastEvent,
							object: N.ZWNR_lastObject
						};
						PL.push(I);
					});
					Send(undefined, 'LAST_EVENTS_RESULT', PL, send);
					break;

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
							const M = Driver.controller.nodes.get(NID).getValueMetadata(VID);
							const V = Driver.controller.nodes.get(NID).getValue(VID);
							const VI = {
								...VID,
								currentValue: V
							};
							VI.normalizedObject = buildNormalized(VI, NID);
							VI.metadata = M;
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
							const ErrorMSG = `Association: Source ->  ${JSON.stringify(
								Params[0]
							)}, Group -> ${Params[1]}, Destination -> ${JSON.stringify(
								A
							)} is not allowed.`;
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

		function buildNormalized(Payload, Node) {
			try {
				const VID = {
					commandClass: Payload.commandClass,
					endpoint: Payload.endpoint,
					property: Payload.property,
					propertyKey: Payload.propertyKey
				};

				const CCName = getCCName(Payload.commandClass);

				const Meta = Driver.controller.nodes.get(Node).getValueMetadata(VID);

				if (Meta === undefined) {
					return undefined;
				}

				const NO = {};

				NO.commandClass = `${VID.commandClass} - ${CCName}`;

				let Key = 'newValue';

				if (Payload.hasOwnProperty('currentValue')) {
					Key = 'currentValue';
				} else if (Payload.hasOwnProperty('value')) {
					Key = 'value';
				}

				if (
					Meta.states !== undefined &&
					Meta.states[Payload[Key]] !== undefined
				) {
					NO.type = typeof Meta.states[Payload[Key]];
					NO[Key] = Meta.states[Payload[Key]];
					if (Key === 'newValue') {
						NO.prevValue = Meta.states[Payload.prevValue] || Payload.prevValue;
					}
				} else {
					NO.type = typeof Payload[Key];
					NO[Key] = Payload[Key];
					if (Key === 'newValue') {
						NO.prevValue = Payload.prevValue;
					}
				}

				if (Meta.label !== undefined) {
					NO.label = Meta.label;
				} else {
					let Name;
					switch (VID.commandClass) {
						// Thermostat Setpoint
						case 'Thermostat Setpoint':
						case 67:
							Name = ZWaveJS.getEnumMemberName(
								ZWaveJS.ThermostatSetpointType,
								VID.propertyKey
							);
					}
					NO.label = Name;
				}

				if (Meta.unit !== undefined) NO.unit = Meta.unit;
				if (Meta.description !== undefined) NO.description = Meta.description;

				return NO;
			} catch (Err) {
				return undefined;
			}
		}

		function Send(Node, Subject, Value, send) {
			// ACTION_DONE is only to sync the state of the UI, we therefore should not pass this on to user reqeusts.
			// Check if the callback name starts with SERV_ to identify these requests
			if (Subject === 'ACTION_DONE') {
				if (send === undefined || !send.name.startsWith('SERV_')) {
					return;
				}
			}

			// Stop UI Data reaching the User via DNs
			let SendDNs = true;
			if (send !== undefined && send.name.startsWith('SERV_')) {
				SendDNs = false;
			}

			const PL = {};
			PL.networkId = NetworkIdentifier;

			let IsolatedNodeId;

			if (Node !== undefined) {
				PL.node = Node.nodeId || Node.id;
				IsolatedNodeId = Node.targetFlowNode || undefined;
			}

			if (Node !== undefined) {
				const N = getNodeInfoForPayload(Node.nodeId || Node.id, 'name');
				if (N !== undefined) {
					PL.nodeName = N;
				}
				const L = getNodeInfoForPayload(Node.nodeId || Node.id, 'location');
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
				_Subject = '[Node: ' + (Node.nodeId || Node.id) + '] [' + Subject + ']';
			} else {
				_Subject = '[' + Subject + ']';
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
				'DEAD',
				'ALIVE',
				'VALUE_ID_LIST',
				'GET_VALUE_RESPONSE',
				'GET_VALUE_METADATA_RESPONSE',
				'VALUE_TIMESTAMP'
			];

			const TimestampSubjects = [
				'VALUE_NOTIFICATION',
				'NOTIFICATION',
				'VALUE_UPDATED',
				'WAKE_UP',
				'ALIVE'
			];

			if (TimestampSubjects.includes(Subject)) {
				Driver.controller.nodes.get(Node.nodeId || Node.id).ZWNR_lastSeen =
					PL.timestamp;
				Driver.controller.nodes.get(Node.nodeId || Node.id).ZWNR_lastEvent =
					PL.event;
				Driver.controller.nodes.get(Node.nodeId || Node.id).ZWNR_lastObject =
					PL.object;
			}

			if (AllowedSubjectsForDNs.includes(Subject) && SendDNs) {
				if (IsolatedNodeId !== undefined) {
					Log(
						'debug',
						'NDERED',
						'OUT',
						_Subject,
						'[ISOLATED] [' + IsolatedNodeId + '] Forwarding payload...'
					);
					NodeEventEmitter.emit(
						`zwjs:${NetworkIdentifier}:node:event:isloated:${IsolatedNodeId}`,
						{
							payload: PL
						}
					);
				} else {
					Log(
						'debug',
						'NDERED',
						'OUT',
						_Subject,
						'[EVENT] Forwarding payload...'
					);
					NodeEventEmitter.emit(`zwjs:${NetworkIdentifier}:node:event:all`, {
						payload: PL
					});
					NodeEventEmitter.emit(
						`zwjs:${NetworkIdentifier}:node:event:${Node.nodeId || Node.id}`,
						{ payload: PL }
					);
				}
			}
		}

		InitDriver();
		StartDriver();

		function InitDriver() {
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

			UI.Register(Driver, Input);
			WireDriverEvents();
		}

		function WireDriverEvents() {
			Driver.on('error', (e) => {
				if (e.code === ZWaveErrorCodes.Driver_Failed) {
					Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
					RedNode.error(e);
					if (CanRecover) {
						RecoverDriver(15);
						UI.Unregister(true);
					} else {
						UI.Unregister(false);
					}
				} else {
					Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
					RedNode.error(e);
				}
			});

			// All nodes ready
			Driver.on(event_AllNodesReady.zwaveName, () => {
				SetFlowNodeStatus({
					fill: 'green',
					shape: 'dot',
					text: event_AllNodesReady.statusName
				});
				UI.Status(event_AllNodesReady.statusName);
				Send(undefined, event_AllNodesReady.redName);
			});

			// driver ready
			Driver.once(event_DriverReady.zwaveName, () => {
				SetFlowNodeStatus({
					fill: 'yellow',
					shape: 'dot',
					text: 'Initializing network...'
				});
				UI.Status('Initializing network...');

				// Add, Remove
				Driver.controller.on(event_NodeAdded.zwaveName, (N) => {
					ShareNodeList();
					WireNodeEvents(N);
					Send(N, event_NodeAdded.redName);
					Send(N, event_InterviewStarted.redName);
					SetFlowNodeStatus({
						fill: 'yellow',
						shape: 'dot',
						text: event_InterviewStarted.statusNameWithNode(N)
					});
					UI.Status(event_InterviewStarted.statusNameWithNode(N));
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
					SetFlowNodeStatus({
						fill: 'yellow',
						shape: 'dot',
						text: event_InclusionStarted.statusName
					});
					UI.Status(event_InclusionStarted.statusName);
				});
				Driver.controller.on(event_InclusionFailed.zwaveName, () => {
					Send(undefined, event_InclusionFailed.redName);
					SetFlowNodeStatus({
						fill: 'red',
						shape: 'dot',
						text: event_InclusionFailed.statusName
					});
					UI.Status(event_InclusionFailed.statusName);
					RestoreReadyStatus();
				});
				Driver.controller.on(event_InclusionStopped.zwaveName, () => {
					Send(undefined, event_InclusionStopped.redName);
					SetFlowNodeStatus({
						fill: 'green',
						shape: 'dot',
						text: event_InclusionStopped.statusName
					});
					UI.Status(event_InclusionStopped.statusName);
				});

				// Exclusion
				Driver.controller.on(event_ExclusionStarted.zwaveName, () => {
					Send(undefined, event_ExclusionStarted.redName);
					SetFlowNodeStatus({
						fill: 'yellow',
						shape: 'dot',
						text: event_ExclusionStarted.statusName
					});
					UI.Status(event_ExclusionStarted.statusName);
				});
				Driver.controller.on(event_ExclusionFailed.zwaveName, () => {
					Send(undefined, event_ExclusionFailed.redName);
					SetFlowNodeStatus({
						fill: 'red',
						shape: 'dot',
						text: event_ExclusionFailed.statusName
					});
					UI.Status(event_ExclusionFailed.statusName);
					RestoreReadyStatus();
				});
				Driver.controller.on(event_ExclusionStopped.zwaveName, () => {
					Send(undefined, event_ExclusionStopped.redName);
					SetFlowNodeStatus({
						fill: 'green',
						shape: 'dot',
						text: event_ExclusionStopped.statusName
					});
					UI.Status(event_ExclusionStopped.statusName);
					RestoreReadyStatus();
				});

				// Heal
				Driver.controller.on(event_NetworkHealDone.zwaveName, () => {
					Send(undefined, event_NetworkHealDone.redName, {
						Successful: Heal_Done,
						Failed: Heal_Failed,
						Skipped: Heal_Skipped
					});
					SetFlowNodeStatus({
						fill: 'green',
						shape: 'dot',
						text: event_NetworkHealDone.statusName
					});
					UI.Status(event_NetworkHealDone.statusName);
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

					SetFlowNodeStatus({
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

					UI.Status(
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
			if (Node.isControllerNode) {
				return;
			}

			Node.once(event_Ready.zwaveName, () => {
				Node.on(event_FirmwareUpdateFinished.zwaveName, (N, R) => {
					Send(N, event_FirmwareUpdateFinished.redName, R);
				});

				Node.on(event_ValueNotification.zwaveName, (N, VL) => {
					VL.normalizedObject = buildNormalized(VL, N.id);
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
					VL.normalizedObject = buildNormalized(VL, N.id);
					Send(N, event_ValueUpdated.redName, VL);
				});

				Node.on(event_ValueAdded.zwaveName, (N, VL) => {
					VL.normalizedObject = buildNormalized(VL, N.id);
					Send(N, event_ValueUpdated.redName, VL); // we dont differentiate between added, update - cant see the need.
				});

				Node.on(event_Wake.zwaveName, (N) => {
					Send(N, event_Wake.redName);
				});

				Node.on(event_Sleep.zwaveName, (N) => {
					Send(N, event_Sleep.redName);
				});

				Node.on(event_Dead.zwaveName, (N) => {
					Send(N, event_Dead.redName);
				});

				Node.on(event_Alive.zwaveName, (N) => {
					Send(N, event_Alive.redName);
				});
			});

			Node.on(event_InterviewStarted.zwaveName, (N) => {
				Send(N, event_InterviewStarted.redName);
				SetFlowNodeStatus({
					fill: 'yellow',
					shape: 'dot',
					text: event_InterviewStarted.statusNameWithNode(N)
				});
				UI.Status(event_InterviewStarted.statusNameWithNode(N));
			});

			Node.on(event_InterviewFailed.zwaveName, (N, Er) => {
				if (Er.isFinal) {
					Send(N, event_InterviewFailed.redName, Er);
					SetFlowNodeStatus({
						fill: 'red',
						shape: 'dot',
						text: event_InterviewFailed.statusNameWithNode(N)
					});
					UI.Status(event_InterviewFailed.statusNameWithNode(N));
					RestoreReadyStatus();
				}
			});

			Node.on(event_InterviewCompleted.zwaveName, (N) => {
				Send(N, event_InterviewCompleted.redName);
				SetFlowNodeStatus({
					fill: 'green',
					shape: 'dot',
					text: event_InterviewCompleted.statusNameWithNode(N)
				});
				UI.Status(event_InterviewCompleted.statusNameWithNode(N));
				RestoreReadyStatus();
			});
		}

		function StartDriver() {
			Log('info', 'NDERED', undefined, undefined, 'Starting driver...');
			Driver.start()
				.catch((e) => {
					if (e.code === ZWaveErrorCodes.Driver_Failed) {
						Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
						RedNode.error(e);
						if (CanRecover) {
							RecoverDriver(15);
							UI.Unregister(true);
						} else {
							UI.Unregister(false);
						}
					}
				})
				.then(() => {
					CanRecover = true;
				});
		}
	}

	RED.nodes.registerType('zwave-js', Init);
};
