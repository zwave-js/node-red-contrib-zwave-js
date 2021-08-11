'use strict';
const express = require("express");

const _Context = {};
let _RED;

const CONTROLLER_EVENTS = ['node added', 'node removed'];

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

	init: (RED) => {
		_RED = RED;

		RED.httpAdmin.get('/zwave-js/fetch-driver-status', function (req, res) {
			res.status(200).end();
			_SendStatus();
		});

		RED.httpAdmin.get('/zwave-js/driverready', function (req, res) {
			const Loaded = _Context.hasOwnProperty('controller');
			res.contentType('application/json');
			res.send({ ready: Loaded });
		});

		/* Res */
		RED.httpAdmin.use('/zwave-js/res', express.static(__dirname))

		RED.httpAdmin.post('/zwave-js/firmwareupdate/:code', function (req, res) {
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
		});

		RED.httpAdmin.post('/zwave-js/cmd', (req, res) => {
			if (req.body.noWait) {
				res.status(202).end();
			}

			const timeout = setTimeout(() => res.status(504).end(), 5000);

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
		});
	},
	register: (driver, request) => {
		driver.on('driver ready', () => {
			_Context.controller = driver.controller;
			_Context.input = request;

			CONTROLLER_EVENTS.forEach((event) => {
				_Context.controller.on(event, (...args) => {
					if (event === 'node added') {
						WireNodeEvents(args[0]);
					}
					_RED.comms.publish(`/zwave-js/cmd`, {
						type: 'controller-event',
						event: event
					});
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
