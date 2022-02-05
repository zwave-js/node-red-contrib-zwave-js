const SP = require('serialport');
const ModulePackage = require('../../package.json');
const { CommandClasses } = require('@zwave-js/core');
const ZWaveJS = require('zwave-js');
const ZWJSCFG = require('@zwave-js/config');
const SmartStart = require('./smartstart/server');

const _Context = {};
let _NodeList;
let _RED;
let _CCs;
let _CCMethods;

const CM = new ZWJSCFG.ConfigManager();
CM.loadDeviceIndex();

let LatestStatus;
const _SendStatus = () => {
	_RED.comms.publish(`/zwave-js/status`, {
		status: LatestStatus
	});
};

const SendNodeStatus = (node, status) => {
	_RED.comms.publish(`/zwave-js/cmd`, {
		type: 'node-status',
		node: node.id,
		status: status
	});
};

const SendHealthCheck = (HealthCheck, Statistics) => {
	_RED.comms.publish(`/zwave-js/healthcheck`, {
		payload: { HealthCheck, Statistics }
	});
};

const SendHealthCheckProgress = (Round) => {
	_RED.comms.publish(`/zwave-js/healthcheckprogress`, {
		payload: Round
	});
};

const SendNodeEvent = (type, node, payload) => {
	_RED.comms.publish(`/zwave-js/cmd/${node.id}`, {
		type: type,
		payload: payload
	});
};

const SendBatteryUpdate = (node, payload) => {
	_RED.comms.publish(`/zwave-js/battery`, {
		node: node.id,
		payload: payload
	});
};

const SmartStartCallback = (Event, Code) => {
	switch (Event) {

		case 'Started':
			_RED.comms.publish(`/zwave-js/cmd`, {
				type: 'node-inclusion-step',
				event: 'smart start awaiting codes'
			});
			return true;

		case 'Code':
			const inclusionPackage = ZWaveJS.parseQRCodeString(Code);
			if (inclusionPackage.version === 1) {
				CM.lookupDevice(
					inclusionPackage.manufacturerId,
					inclusionPackage.productType,
					inclusionPackage.productId
				).then((device) => {
					if (device !== undefined) {
						_RED.comms.publish(`/zwave-js/cmd`, {
							type: 'node-inclusion-step',
							event: 'smart start code received',
							data: {
								inclusionPackage: inclusionPackage,
								humaReadable: {
									manufacturer: device.manufacturer,
									label: device.label,
									description: device.description,
									dsk: inclusionPackage.dsk.substring(0, 5)
								}
							}
						});
					} else {
						_RED.comms.publish(`/zwave-js/cmd`, {
							type: 'node-inclusion-step',
							event: 'smart start code received',
							data: {
								inclusionPackage: inclusionPackage,
								humaReadable: {
									dsk: inclusionPackage.dsk.substring(0, 5)
								}
							}
						});
					}
				});

				return 1;
			} else {
				return 0;
			}
	}
};

module.exports = {
	status: (Message) => {
		LatestStatus = Message;
		_SendStatus();
	},

	upateNodeList: (Nodes) => {
		_NodeList = Nodes;
	},

	init: (RED) => {
		_RED = RED;

		// Smart Start List
		RED.httpAdmin.get(
			'/zwave-js/smart-start-list',
			RED.auth.needsPermission('flows.read'),
			async function (req, res) {
				const JSONEntries = [];
				const Entries = _Context.controller.getProvisioningEntries();

				for (let i = 0; i < Entries.length; i++) {
					const Entry = Entries[i];
					const Device = await CM.lookupDevice(
						Entry.manufacturerId,
						Entry.productType,
						Entry.productId
					);
					JSONEntries.push({
						label: Device.label,
						manufacturer: Device.manufacturer,
						description: Device.description,
						dsk: Entry.dsk
					});
				}
				res.json(JSONEntries);
			}
		);

		// CC LIst
		RED.httpAdmin.get(
			'/zwave-js/cfg-cclist',
			RED.auth.needsPermission('flows.read'),
			function (req, res) {
				if (_CCs !== undefined) {
					res.json(_CCs);
				} else {
					const Check = (CC) => {
						const API = ZWaveJS.getAPI(CommandClasses[CC]);
						if (API !== undefined) {
							const Methods = Object.getOwnPropertyNames(API.prototype).filter(
								(m) => m !== 'constructor' && m !== 'supportsCommand'
							);
							_CCMethods[CC] = Methods;
						}
						return API;
					};
					_CCMethods = {};
					_CCs = Object.keys(CommandClasses).filter(
						(K) => isNaN(K) && Check(K) !== undefined
					);
					res.json(_CCs);
				}
			}
		);
		// CC Op list
		RED.httpAdmin.get(
			'/zwave-js/cfg-cclist/:CC',
			RED.auth.needsPermission('flows.read'),
			function (req, res) {
				res.json(_CCMethods[req.params.CC.replace(/-/g, ' ')]);
			}
		);

		// Node List
		RED.httpAdmin.get(
			'/zwave-js/cfg-nodelist',
			RED.auth.needsPermission('flows.read'),
			function (req, res) {
				res.json(_NodeList);
			}
		);

		// Version
		RED.httpAdmin.get(
			'/zwave-js/cfg-version',
			RED.auth.needsPermission('flows.read'),
			function (req, res) {
				delete require.cache[require.resolve('zwave-js/package.json')];
				const ZWaveJSPackage = require('zwave-js/package.json');
				res.json({
					zwjsversion: ZWaveJSPackage.version,
					zwjscfgversion: ZWaveJSPackage.dependencies['@zwave-js/config'],
					moduleversion: ModulePackage.version
				});
			}
		);

		// serial ports
		RED.httpAdmin.get(
			'/zwave-js/cfg-serialports',
			RED.auth.needsPermission('flows.read'),
			function (req, res) {
				SP.list()
					.then((ports) => {
						const a = ports.map((p) => p.path);
						res.json(a);
					})
					.catch((err) => {
						RED.log.error('Error listing serial ports', err);
						res.json([]);
					});
			}
		);

		// Driver State
		RED.httpAdmin.get(
			'/zwave-js/fetch-driver-status',
			RED.auth.needsPermission('flows.read'),
			function (req, res) {
				res.status(200).end();
				_SendStatus();
			}
		);

		// ready Check
		RED.httpAdmin.get(
			'/zwave-js/driverready',
			RED.auth.needsPermission('flows.read'),
			function (req, res) {
				const Loaded = _Context.hasOwnProperty('controller');
				res.contentType('application/json');
				res.send({ ready: Loaded });
			}
		);
		
		// Frimware
		RED.httpAdmin.post(
			'/zwave-js/firmwareupdate/:code',
			RED.auth.needsPermission('flows.write'),
			function (req, res) {
				let _Buffer = Buffer.alloc(0);
				req.on('data', (Data) => {
					_Buffer = Buffer.concat([_Buffer, Data]);
				});

				req.once('end', () => {
					const Code = req.params.code;
					const CodeBuffer = Buffer.from(Code, 'base64');
					const CodeString = CodeBuffer.toString('ascii');
					const Parts = CodeString.split(':');

					const PL = {
						mode: 'ControllerAPI',
						method: 'beginFirmwareUpdate',
						params: [parseInt(Parts[0]), parseInt(Parts[1]), Parts[2], _Buffer]
					};

					const Success = () => {
						res.status(200).end();
					};

					const Error = (err) => {
						if (err) {
							res.status(500).send(err.message);
						}
					};
					_Context.input({ payload: PL }, Success, Error);
				});
			}
		);

		// Smart Start
		SmartStart.Prep(RED.httpAdmin);
		RED.httpAdmin.get(
			'/zwave-js/smartstart/:Method',
			RED.auth.needsPermission('flows.write'),
			async (req, res) => {
				switch (req.params.Method) {
					case 'startserver':
						SmartStart.Start(SmartStartCallback,req).then((QRCode) => {
							res.status(200);
							res.end(QRCode);
						});
						break;
					case 'stopserver':
						SmartStart.Stop();
						res.status(200);
						res.end();
						break;
				}
			}
		);

		// Commands
		RED.httpAdmin.post(
			'/zwave-js/cmd',
			RED.auth.needsPermission('flows.write'),
			async (req, res) => {
				const timeout = setTimeout(() => res.status(504).end(), 5000);

				if (req.body.noTimeout) {
					clearTimeout(timeout);
				}

				try {
					if (req.body.noWait) {
						res.status(202).end();
					}

					const ResponseProcessor = (Response) => {
						clearTimeout(timeout);

						// Health Checks!
						// These can take a few minutes, and UA timeouts cant be changed :(
						// We therefore deliver HCs via the socket API - and dont wait for them on the client interface.

						if (Response.payload.event === 'HEALTH_CHECK_RESULT') {
							const Health = Response.payload.object.health;
							const Node = Response.payload.object.node;
							let Stats;

							const StatReq = {
								payload: {
									mode: 'DriverAPI',
									method: 'getNodeStatistics',
									params: [Node]
								}
							};

							_Context.input(StatReq, (Result) => {
								Stats = Result.payload.object;
								SendHealthCheck(Health, Stats);
							});

							return; // no need to do anything else here.
						}

						if (!req.body.noWait) {
							res.send(Response.payload);
						}
					};

					const DoneHandler = (Err) => {
						if (Err) {
							clearTimeout(timeout);
							if (!req.body.noWait) {
								res.status(500).send(Err.message);
							}
						}
					};

					const PL = {
						payload: req.body
					};

					if (
						PL.payload.mode === 'DriverAPI' &&
						PL.payload.method === 'checkLifelineHealth'
					) {
						const HCProgress = (R) => {
							SendHealthCheckProgress(R);
						};
						PL.payload.params.push(HCProgress);
					}
					_Context.input(PL, ResponseProcessor, DoneHandler);
				} catch (err) {
					clearTimeout(timeout);
					if (!req.body.noWait) {
						res
							.status(500)
							.send('_Context.input, is re-initializing. Please try again.');
					}
				}
			}
		);
	},
	sendEvent: (Type, Event, args) => {
		_RED.comms.publish(`/zwave-js/cmd`, {
			type: Type,
			event: Event,
			...args
		});
	},
	register: (driver, request) => {
		driver.on('driver ready', () => {
			_Context.controller = driver.controller;
			_Context.input = request;

			_Context.controller.on('inclusion started', () => {
				_RED.comms.publish(`/zwave-js/cmd`, {
					type: 'node-inclusion-step',
					event: 'inclusion started'
				});
			});

			_Context.controller.on('exclusion started', () => {
				_RED.comms.publish(`/zwave-js/cmd`, {
					type: 'node-inclusion-step',
					event: 'exclusion started'
				});
			});

			_Context.controller.on('exclusion stopped', () => {
				_RED.comms.publish(`/zwave-js/cmd`, {
					type: 'node-inclusion-step',
					event: 'exclusion stopped'
				});
			});

			_Context.controller.on('node added', (N, IR) => {
				WireNodeEvents(N);
				_RED.comms.publish(`/zwave-js/cmd`, {
					type: 'node-collection-change',
					event: 'node added',
					inclusionResult: IR
				});
			});

			_Context.controller.on('node removed', () => {
				_RED.comms.publish(`/zwave-js/cmd`, {
					type: 'node-collection-change',
					event: 'node removed'
				});
			});

			const WireNodeEvents = (node) => {
				// Status
				node.on('sleep', (node) => {
					SendNodeStatus(node, 'ASLEEP');
				});
				node.on('wake up', (node) => {
					SendNodeStatus(node, 'AWAKE');
				});
				node.on('dead', (node) => {
					SendNodeStatus(node, 'DEAD');
				});
				node.on('alive', (node) => {
					SendNodeStatus(node, 'ALIVE');
				});
				node.on('ready', (node) => {
					SendNodeStatus(node, 'READY');
				});

				// Values
				node.on('value added', (node, value) => {
					SendNodeEvent('node-value', node, value);
					if (value.commandClass === 128) {
						SendBatteryUpdate(node, value);
					}
				});
				node.on('value updated', (node, value) => {
					SendNodeEvent('node-value', node, value);
					if (value.commandClass === 128) {
						SendBatteryUpdate(node, value);
					}
				});
				node.on('value removed', (node, value) => {
					SendNodeEvent('node-value', node, value);
				});
				node.on('value notification', (node, value) => {
					SendNodeEvent('node-value', node, value);
				});
				node.on('notification', (node, value) => {
					SendNodeEvent('node-value', node, value);
				});
				node.on('firmware update progress', (node, S, R) => {
					SendNodeEvent('node-fwu-progress', node, { sent: S, remain: R });
				});
				node.on('firmware update finished', (node, Status) => {
					SendNodeEvent('node-fwu-completed', node, { status: Status });
				});

				// Meta
				node.on('metadata update', (node, value) => {
					SendNodeEvent('node-meta', node, value);
				});
			};

			_Context.controller.nodes.forEach((node) => {
				WireNodeEvents(node);
			});
		});
	},
	unregister: () => {
		delete _Context.controller;
		delete _Context.input;
	}
};
