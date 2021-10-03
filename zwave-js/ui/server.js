const express = require('express');
const SP = require('serialport');
const ModulePackage = require('../../package.json');
const { CommandClasses } = require('@zwave-js/core');
const { getAPI } = require('zwave-js/lib/commandclass/CommandClass');

const _Context = {};
let _NodeList;
let _RED;
let _CCs;
let _CCMethods;

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

const SendNodeEvent = (type, node, payload) => {
	_RED.comms.publish(`/zwave-js/cmd/${node.id}`, {
		type: type,
		payload: payload
	});
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

		// CC LIst
		RED.httpAdmin.get(
			'/zwave-js/cfg-cclist',
			RED.auth.needsPermission('flows.read'),
			function (req, res) {
				if (_CCs !== undefined) {
					res.json(_CCs);
				} else {
					const Check = (CC) => {
						const API = getAPI(CommandClasses[CC]);
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

		/* Res */
		RED.httpAdmin.use('/zwave-js/res', express.static(__dirname));

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
						SendNodeStatus({ id: Parts[0] }, 'UPDATING FIRMWARE');
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

					_Context.input(
						{ payload: req.body },
						(zwaveRes) => {
							clearTimeout(timeout);
							if (!req.body.noWait) {
								res.send(zwaveRes.payload);
							}
						},
						(err) => {
							if (err) {
								clearTimeout(timeout);
								if (!req.body.noWait) {
									res.status(500).send(err.message);
								}
							}
						}
					);
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
				});
				node.on('value updated', (node, value) => {
					SendNodeEvent('node-value', node, value);
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
