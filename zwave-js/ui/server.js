const SP = require('serialport').SerialPort;
const ModulePackage = require('../../package.json');
const { CommandClasses } = require('@zwave-js/core');
const ZWaveJS = require('zwave-js');
const ZWJSCFG = require('@zwave-js/config');
const SmartStart = require('./smartstart/server');

const _CM = new ZWJSCFG.ConfigManager();
_CM.loadDeviceIndex();

let _CCs = [];
const _CCMethods = {};
let _GlobalInit = false;

const _Check = (CC) => {
	const API = ZWaveJS.getAPI(CommandClasses[CC]);
	if (API !== undefined) {
		const Methods = Object.getOwnPropertyNames(API.prototype).filter(
			(m) => m !== 'constructor' && m !== 'supportsCommand'
		);
		_CCMethods[CC] = Methods;
	}
	return API;
};

const SetupGlobals = function (RED) {
	if (_GlobalInit) return;

	_CCs = Object.keys(CommandClasses).filter(
		(K) => isNaN(K) && _Check(K) !== undefined
	);

	RED.httpAdmin.get(
		`/zwave-js/cfg-cclist`,
		RED.auth.needsPermission('flows.read'),
		function (req, res) {
			res.json(_CCs);
		}
	);

	RED.httpAdmin.get(
		`/zwave-js/cfg-cclist/:CC`,
		RED.auth.needsPermission('flows.read'),
		function (req, res) {
			res.json(_CCMethods[req.params.CC.replace(/-/g, ' ')]);
		}
	);

	RED.httpAdmin.get(
		`/zwave-js/cfg-version`,
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

	RED.httpAdmin.get(
		`/zwave-js/cfg-serialports`,
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

	_GlobalInit = true;
};

class UIServer {
	constructor(RED, ID) {
		const self = this;

		this._Context = {};
		this._NodeList;
		this._RED = RED;

		this._NetworkIdentifier = ID;
		this._LatestStatus;
		this._CM = new ZWJSCFG.ConfigManager();
		this._CM.loadDeviceIndex();

		this._RED.httpAdmin.get(
			`/zwave-js/${this._NetworkIdentifier}/ping`,
			this._RED.auth.needsPermission('flows.read'),
			async function (req, res) {
				res.contentType('text/plain');
				res.send('pong');
				res.end(200);
			}
		);

		this._RED.httpAdmin.get(
			`/zwave-js/${this._NetworkIdentifier}/smart-start-list`,
			this._RED.auth.needsPermission('flows.read'),
			async function (req, res) {
				const JSONEntries = [];
				const Entries = self._Context.controller.getProvisioningEntries();

				for (let i = 0; i < Entries.length; i++) {
					const Entry = Entries[i];
					const Device = await self._CM.lookupDevice(
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

		this._RED.httpAdmin.get(
			`/zwave-js/${this._NetworkIdentifier}/cfg-nodelist`,
			this._RED.auth.needsPermission('flows.read'),
			function (req, res) {
				res.json(self._NodeList);
			}
		);

		this._RED.httpAdmin.get(
			`/zwave-js/${this._NetworkIdentifier}/fetch-driver-status`,
			this._RED.auth.needsPermission('flows.read'),
			function (req, res) {
				res.status(200).end();
				self._SendStatus();
			}
		);

		this._RED.httpAdmin.get(
			`/zwave-js/${this._NetworkIdentifier}/driverready`,
			this._RED.auth.needsPermission('flows.read'),
			function (req, res) {
				const Loaded = self._Context.hasOwnProperty('controller');
				res.contentType('application/json');
				res.send({ ready: Loaded });
			}
		);

		this._RED.httpAdmin.post(
			`/zwave-js/${this._NetworkIdentifier}/firmwareupdate/:code`,
			this._RED.auth.needsPermission('flows.write'),
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
					self._Context.input({ payload: PL }, Success, Error);
				});
			}
		);

		SmartStart.Prep(this._RED.httpAdmin);
		this._RED.httpAdmin.get(
			`/zwave-js/${this._NetworkIdentifier}/smartstart/:Method`,
			this._RED.auth.needsPermission('flows.write'),
			async (req, res) => {
				switch (req.params.Method) {
					case 'startserver':
						SmartStart.Start(self._SmartStartCallback, req).then((QRCode) => {
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

		this._RED.httpAdmin.post(
			`/zwave-js/${this._NetworkIdentifier}/cmd`,
			this._RED.auth.needsPermission('flows.write'),
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

							self._Context.input(StatReq, (Result) => {
								Stats = Result.payload.object;
								self._SendHealthCheck(Health, Stats);
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
							self._SendHealthCheckProgress(R);
						};
						PL.payload.params.push(HCProgress);
					}
					self._Context.input(PL, ResponseProcessor, DoneHandler);
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
	}
}

UIServer.prototype.Register = function (driver, request) {
	driver.on('driver ready', () => {
		this._Context.controller = driver.controller;
		this._Context.input = request;

		this._Context.controller.on('inclusion started', () => {
			this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/cmd`, {
				type: 'node-inclusion-step',
				event: 'inclusion started'
			});
		});

		this._Context.controller.on('exclusion started', () => {
			this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/cmd`, {
				type: 'node-inclusion-step',
				event: 'exclusion started'
			});
		});

		this._Context.controller.on('exclusion stopped', () => {
			this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/cmd`, {
				type: 'node-inclusion-step',
				event: 'exclusion stopped'
			});
		});

		this._Context.controller.on('node added', (N, IR) => {
			this._WireNodeEvents(N);
			this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/cmd`, {
				type: 'node-collection-change',
				event: 'node added',
				inclusionResult: IR
			});
		});

		this._Context.controller.on('node removed', () => {
			this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/cmd`, {
				type: 'node-collection-change',
				event: 'node removed'
			});
		});

		this._Context.controller.nodes.forEach((node) => {
			this._WireNodeEvents(node);
		});
	});
};

UIServer.prototype._WireNodeEvents = function (node) {
	// Status
	node.on('sleep', (node) => {
		this._SendNodeStatus(node, 'ASLEEP');
	});
	node.on('wake up', (node) => {
		this._SendNodeStatus(node, 'AWAKE');
	});
	node.on('dead', (node) => {
		this._SendNodeStatus(node, 'DEAD');
	});
	node.on('alive', (node) => {
		this._SendNodeStatus(node, 'ALIVE');
	});
	node.on('ready', (node) => {
		this._SendNodeStatus(node, 'READY');
	});

	// Values
	node.on('value added', (node, value) => {
		this._SendNodeEvent('node-value', node, value);
		if (value.commandClass === 128) {
			this._SendBatteryUpdate(node, value);
		}
	});
	node.on('value updated', (node, value) => {
		this._SendNodeEvent('node-value', node, value);
		if (value.commandClass === 128) {
			this._SendBatteryUpdate(node, value);
		}
	});
	node.on('value removed', (node, value) => {
		this._SendNodeEvent('node-value', node, value);
	});
	node.on('value notification', (node, value) => {
		this._SendNodeEvent('node-value', node, value);
	});
	node.on('notification', (node, value) => {
		this._SendNodeEvent('node-value', node, value);
	});
	node.on('firmware update progress', (node, S, R) => {
		this._SendNodeEvent('node-fwu-progress', node, { sent: S, remain: R });
	});
	node.on('firmware update finished', (node, Status) => {
		this._SendNodeEvent('node-fwu-completed', node, { status: Status });
	});

	// Meta
	node.on('metadata update', (node, value) => {
		this._SendNodeEvent('node-meta', node, value);
	});
};

UIServer.prototype._SendBatteryUpdate = function (node, payload) {
	this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/battery`, {
		node: node.id,
		payload: payload
	});
};

UIServer.prototype.Unregister = function () {
	const Routes = [];
	this._RED.httpAdmin._router.stack.forEach((R) => {
		if (R.route === undefined) {
			Routes.push(R);
			return;
		}
		if (!R.route.path.startsWith(`/zwave-js/${this._NetworkIdentifier}`)) {
			Routes.push(R);
			return;
		}
	});

	this._RED.httpAdmin._router.stack = Routes;

	delete this._Context.controller;
	delete this._Context.input;
};

UIServer.prototype._SendStatus = function () {
	this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/status`, {
		status: this._LatestStatus
	});
};

UIServer.prototype._SendNodeStatus = function (node, status) {
	this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/cmd`, {
		type: 'node-status',
		node: node.id,
		status: status
	});
};

UIServer.prototype._SendHealthCheck = function (HealthCheck, Statistics) {
	this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/healthcheck`, {
		payload: { HealthCheck, Statistics }
	});
};

UIServer.prototype._SendHealthCheckProgress = function (Round) {
	this._RED.comms.publish(
		`/zwave-js/${this._NetworkIdentifier}/healthcheckprogress`,
		{
			payload: Round
		}
	);
};

UIServer.prototype._SendNodeEvent = function (type, node, payload) {
	this._RED.comms.publish(
		`/zwave-js/${this._NetworkIdentifier}/cmd/${node.id}`,
		{
			type: type,
			payload: payload
		}
	);
};

UIServer.prototype._SmartStartCallback = function (Event, Code) {
	switch (Event) {
		case 'Started':
			this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/cmd`, {
				type: 'node-inclusion-step',
				event: 'smart start awaiting codes'
			});
			return true;

		case 'Code':
			const inclusionPackage = ZWaveJS.parseQRCodeString(Code);
			if (inclusionPackage.version === 1) {
				this._CM
					.lookupDevice(
						inclusionPackage.manufacturerId,
						inclusionPackage.productType,
						inclusionPackage.productId
					)
					.then((device) => {
						if (device !== undefined) {
							this._RED.comms.publish(
								`/zwave-js/${this._NetworkIdentifier}/cmd`,
								{
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
								}
							);
						} else {
							this._RED.comms.publish(
								`/zwave-js/${this._NetworkIdentifier}/cmd`,
								{
									type: 'node-inclusion-step',
									event: 'smart start code received',
									data: {
										inclusionPackage: inclusionPackage,
										humaReadable: {
											dsk: inclusionPackage.dsk.substring(0, 5)
										}
									}
								}
							);
						}
					});

				return 1;
			} else {
				return 0;
			}
	}
};

UIServer.prototype.Status = function (Message) {
	this._LatestStatus = Message;
	this._SendStatus();
};

UIServer.prototype.SendEvent = function (Type, Event, args) {
	this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/cmd`, {
		type: Type,
		event: Event,
		...args
	});
};

UIServer.prototype.UpateNodeList = function (Nodes) {
	this._NodeList = Nodes;
};

module.exports = {
	UIServer: UIServer,
	SetupGlobals: SetupGlobals
};
