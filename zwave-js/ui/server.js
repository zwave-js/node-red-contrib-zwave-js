const ModulePackage = require('../../package.json');
const { CommandClasses } = require('@zwave-js/core');
const ZWaveJS = require('zwave-js');
const ZWJSCFG = require('@zwave-js/config');
const SmartStart = require('./smartstart/server');
const FS = require('fs');
const path = require('path');
const Multipart = require('./multipart');

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

let AvailableNIDs = [1, 2, 3, 4];
let UsedNIDs = [];

const SetupGlobals = function (RED) {
	if (_GlobalInit) return;

	_CCs = Object.keys(CommandClasses).filter(
		(K) => isNaN(K) && _Check(K) !== undefined
	);

	RED.httpAdmin.get(
		`/zwave-js/cfg-getids`,
		RED.auth.needsPermission('flows.read'),
		(req, res) => {
			AvailableNIDs.sort();
			UsedNIDs.sort();
			res.json({ AvailableNIDs, UsedNIDs });
		}
	);

	RED.httpAdmin.get(
		`/zwave-js/cfg-cclist`,
		RED.auth.needsPermission('flows.read'),
		(req, res) => {
			res.json(_CCs);
		}
	);

	RED.httpAdmin.get(
		`/zwave-js/cfg-cclist/:CC`,
		RED.auth.needsPermission('flows.read'),
		(req, res) => {
			res.json(_CCMethods[req.params.CC.replace(/-/g, ' ')]);
		}
	);

	RED.httpAdmin.get(
		`/zwave-js/cfg-version`,
		RED.auth.needsPermission('flows.read'),
		(req, res) => {
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
		(req, res) => {
			ZWaveJS.Driver.enumerateSerialPorts()
				.then((ports) => {
					res.json(ports);
				})
				.catch((err) => {
					RED.log.error(`Error listing serial ports: ${err}`);
					res.json([]);
				});
		}
	);

	RED.httpAdmin.get(`/zwave-js/mesh`, (req, res) => {
		const Secure = req.connection.encrypted !== undefined;
		const Prot = Secure ? 'https://' : 'http://';

		const PageFIle = path.join(
			__dirname,
			'../',
			'../',
			'resources',
			'MeshMap',
			'Map.html'
		);

		const Prefix = RED.settings.httpAdminRoot || '/';
		const Base = `${Prot}${req.headers.host}${Prefix}resources/node-red-contrib-zwave-js/MeshMap`;
		let Source = FS.readFileSync(PageFIle, 'utf8');
		Source = Source.replace(/{BASE}/g, Base);

		res.contentType('text/html');
		res.send(Source);
	});

	_GlobalInit = true;
};

class UIServer {
	constructor(RED, ID) {
		this._Context = {};
		this._NodeList = undefined;
		this._RED = RED;
		this._SmartStartCallback = this._SmartStartCallback.bind(this);

		this._NetworkIdentifier = ID;

		AvailableNIDs = AvailableNIDs.filter(
			(_ID) => _ID !== this._NetworkIdentifier
		);
		UsedNIDs.push(this._NetworkIdentifier);

		this._LatestStatus = undefined;
		this._CM = new ZWJSCFG.ConfigManager();
		this._CM.loadDeviceIndex();

		this._RED.httpAdmin.get(
			`/zwave-js/${this._NetworkIdentifier}/smart-start-list`,
			this._RED.auth.needsPermission('flows.read'),
			async (req, res) => {
				if (this._Context.controller === undefined) {
					res.status(500).send('The Controller is currently unavailable.');
					return;
				}

				const JSONEntries = [];
				const Entries = this._Context.controller.getProvisioningEntries();

				for (let i = 0; i < Entries.length; i++) {
					const Entry = Entries[i];
					const Device = await this._CM.lookupDevice(
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
			(req, res) => {
				res.json(this._NodeList);
			}
		);

		this._RED.httpAdmin.get(
			`/zwave-js/${this._NetworkIdentifier}/fetch-driver-status`,
			this._RED.auth.needsPermission('flows.read'),
			(req, res) => {
				res.status(200).end();
				this._SendStatus();
			}
		);

		this._RED.httpAdmin.get(
			`/zwave-js/${this._NetworkIdentifier}/driverready`,
			this._RED.auth.needsPermission('flows.read'),
			(req, res) => {
				const Loaded = this._Context.hasOwnProperty('controller');
				res.contentType('application/json');
				res.send({ ready: Loaded });
			}
		);

		this._RED.httpAdmin.post(
			`/zwave-js/${this._NetworkIdentifier}/restorenvm`,
			this._RED.auth.needsPermission('flows.write'),
			async (req, res) => {
				if (this._Context.controller === undefined) {
					res.status(500).send('The Controller is currently unavailable.');
					return;
				}

				const buffers = [];
				for await (const chunk of req) {
					buffers.push(chunk);
				}

				const data = Buffer.concat(buffers);

				const Boundary = Multipart.getBoundary(req.headers['content-type']);
				const Parts = Multipart.parse(data, Boundary);

				const _Buffer = Parts.filter((P) => P.hasOwnProperty('filename'))[0]
					.data;

				const SERV_Done = () => {
					this._SendNVMRestoreDone();
				};

				const SERV_Error = (Err) => {
					if (Err) {
						this._SendNVMRestoreError(Err);
					}
				};

				const SERV_Convert = (Read, Total) => {
					const Percent = (Read / Total) * 100;
					this._SendNVMRestoreProgress('Convert', Percent);
				};

				const SERV_Apply = (Read, Total) => {
					const Percent = (Read / Total) * 100;
					this._SendNVMRestoreProgress('Apply', Percent);
				};

				const PL = {
					mode: 'ControllerAPI',
					method: 'restoreNVM',
					params: [_Buffer, SERV_Convert, SERV_Apply]
				};

				this._Context.input({ payload: PL }, SERV_Done, SERV_Error);

				res.status(202).end();
			}
		);

		this._RED.httpAdmin.post(
			`/zwave-js/${this._NetworkIdentifier}/firmwareupdate`,
			this._RED.auth.needsPermission('flows.write'),
			async (req, res) => {
				if (this._Context.controller === undefined) {
					res.status(500).send('The Controller is currently unavailable.');
					return;
				}

				const buffers = [];
				for await (const chunk of req) {
					buffers.push(chunk);
				}

				const data = Buffer.concat(buffers);

				const Boundary = Multipart.getBoundary(req.headers['content-type']);
				const Parts = Multipart.parse(data, Boundary);

				let NodeID = Parts.filter((P) => P.name === 'NodeID')[0].data.toString(
					'utf8'
				);
				NodeID = parseInt(NodeID);

				let Target = Parts.filter((P) => P.name === 'Target')[0].data.toString(
					'utf8'
				);
				Target = parseInt(Target);

				const _Buffer = Parts.filter((P) => P.hasOwnProperty('filename'))[0]
					.data;
				const FileName = Parts.filter((P) => P.hasOwnProperty('filename'))[0]
					.filename;

				const PL = {
					mode: 'ControllerAPI',
					method: 'updateFirmware',
					params: [NodeID, Target, FileName, _Buffer]
				};

				const SERV_Success = () => {
					res.status(200).end();
				};

				const Error = (err) => {
					if (err) {
						res.status(500).send(err.message);
					}
				};
				this._Context.input({ payload: PL }, SERV_Success, Error);
			}
		);

		this._RED.httpAdmin.get(
			`/zwave-js/${this._NetworkIdentifier}/smartstart/:Method`,
			this._RED.auth.needsPermission('flows.write'),
			async (req, res) => {
				if (this._Context.controller === undefined) {
					res.status(500).send('The Controller is currently unavailable.');
					return;
				}

				switch (req.params.Method) {
					case 'startserver':
						SmartStart.Start(this, req).then((QRCode) => {
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
				// Some nodes may respond if awake.
				let TimedOut = false;
				const timeout = setTimeout(() => {
					TimedOut = true;
					res.status(504).end();
				}, 15000);

				if (req.body.noTimeout) {
					clearTimeout(timeout);
				}

				if (this._Context.controller === undefined) {
					clearTimeout(timeout);
					res.status(500).send('The Controller is currently unavailable.');
					return;
				}

				if (req.body.noWait) {
					clearTimeout(timeout);
					res.status(202).end();
				}

				const SERV_ResponseProcessor = (Response) => {
					clearTimeout(timeout);

					// NVM Back up result
					if (Response.payload.event === 'NVM_BACKUP') {
						this._SendBackUpFile(Response.payload.object);
						return; // no need to do anything else here
					}

					// HC Result
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

						const SERV_Result = (Response) => {
							Stats = Response.payload.object;
							this._SendHealthCheck(Health, Stats);
						};

						this._Context.input(StatReq, SERV_Result);
						return; // no need to do anything else here.
					}

					// Send to UI - if needed.
					if (!req.body.noWait) {
						if (!TimedOut) {
							res.send(Response.payload);
						}
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

				// Check Life LIne Health
				if (
					PL.payload.mode === 'DriverAPI' &&
					PL.payload.method === 'checkLifelineHealth'
				) {
					const HCProgress = (R) => {
						this._SendHealthCheckProgress(R);
					};
					PL.payload.params.push(HCProgress);
				}

				// Backup NVM
				if (
					PL.payload.mode === 'ControllerAPI' &&
					PL.payload.method === 'backupNVMRaw'
				) {
					const BackupProgress = (Read, Total) => {
						const Percent = (Read / Total) * 100;
						this._SendBackupProgress(Percent);
					};
					PL.payload.params = [];
					PL.payload.params.push(BackupProgress);
				}

				this._Context.input(PL, SERV_ResponseProcessor, DoneHandler);
			}
		);
	}

	// Methods

	Register(driver, request) {
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
					inclusionResult: IR,
					securityClass: N.getHighestSecurityClass()
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
	}

	_WireNodeEvents(node) {
		if (node.isControllerNode) {
			return;
		}

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
		node.on('firmware update progress', (node, Progress) => {
			this._SendNodeEvent('node-fwu-progress', node, {
				sent: Progress.sentFragments,
				remain: Progress.totalFragments - Progress.sentFragments
			});
		});
		node.on('firmware update finished', (node, Result) => {
			this._SendNodeEvent('node-fwu-completed', node, {
				status: Result.status
			});
		});

		// Meta
		node.on('metadata update', (node, value) => {
			this._SendNodeEvent('node-meta', node, value);
		});
	}

	_SendBatteryUpdate(node, payload) {
		this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/battery`, {
			node: node.id,
			payload: payload
		});
	}

	Unregister(InstanceOnly) {
		if (InstanceOnly) {
			delete this._Context.controller;
			delete this._Context.input;
		} else {
			const Check = (Route) => {
				if (Route.route === undefined) {
					return true;
				}
				if (
					!Route.route.path.startsWith(`/zwave-js/${this._NetworkIdentifier}`)
				) {
					return true;
				}

				return false;
			};
			this._RED.httpAdmin._router.stack =
				this._RED.httpAdmin._router.stack.filter(Check);

			delete this._Context.controller;
			delete this._Context.input;

			AvailableNIDs.push(this._NetworkIdentifier);
			UsedNIDs = UsedNIDs.filter((_ID) => _ID !== this._NetworkIdentifier);
		}
	}

	_SendStatus() {
		this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/status`, {
			status: this._LatestStatus
		});
	}

	_SendNodeStatus(node, status) {
		this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/cmd`, {
			type: 'node-status',
			node: node.id,
			status: status
		});
	}

	_SendHealthCheck(HealthCheck, Statistics) {
		this._RED.comms.publish(
			`/zwave-js/${this._NetworkIdentifier}/healthcheck`,
			{
				payload: { HealthCheck, Statistics }
			}
		);
	}

	_SendBackUpFile(Buffer) {
		this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/backupfile`, {
			payload: Buffer
		});
	}

	_SendNVMRestoreDone() {
		this._RED.comms.publish(
			`/zwave-js/${this._NetworkIdentifier}/nvmrestoredone`,
			{}
		);
	}

	_SendNVMRestoreError(Err) {
		this._RED.comms.publish(
			`/zwave-js/${this._NetworkIdentifier}/nvmrestoreerror`,
			{
				payload: Err.message
			}
		);
	}

	_SendNVMRestoreProgress(Type, Progress) {
		this._RED.comms.publish(
			`/zwave-js/${this._NetworkIdentifier}/nvmrestoreprogress`,
			{
				payload: { type: Type, progress: Progress }
			}
		);
	}

	_SendBackupProgress(Percent) {
		this._RED.comms.publish(
			`/zwave-js/${this._NetworkIdentifier}/backupprocess`,
			{
				payload: Percent
			}
		);
	}

	_SendHealthCheckProgress(Round) {
		this._RED.comms.publish(
			`/zwave-js/${this._NetworkIdentifier}/healthcheckprogress`,
			{
				payload: Round
			}
		);
	}

	_SendNodeEvent(type, node, payload) {
		this._RED.comms.publish(
			`/zwave-js/${this._NetworkIdentifier}/cmd/${node.id}`,
			{
				type: type,
				payload: payload
			}
		);
	}

	_SmartStartCallback(Event, Code) {
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
	}

	Status(Message) {
		this._LatestStatus = Message;
		this._SendStatus();
	}

	SendEvent(Type, Event, args) {
		this._RED.comms.publish(`/zwave-js/${this._NetworkIdentifier}/cmd`, {
			type: Type,
			event: Event,
			...args
		});
	}

	UpateNodeList(Nodes) {
		this._NodeList = Nodes;
	}
}

module.exports = {
	UIServer: UIServer,
	SetupGlobals: SetupGlobals
};
