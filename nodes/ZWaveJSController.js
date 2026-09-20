const { getProfile } = require('./lib/RequestResponseProfiles');
const { Check } = require('./lib/MessageValidator');
const MethodChecks = {
	CC: require('./lib/AllowedUsersCommands').CC,
	NODE: require('./lib/AllowedUsersCommands').Node,
	VALUE: require('./lib/AllowedUsersCommands').Value,
	CONTROLLER: require('./lib/AllowedUsersCommands').Controller,
	DRIVER: require('./lib/AllowedUsersCommands').Driver
};

module.exports = (RED) => {
	const init = function (config) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;
		self.runtime = RED.nodes.getNode(self.config.runtimeId);

		let clearTimer;

		const callback = (Data) => {
			switch (Data.Type) {
				case 'STATUS':
					if (!config.hideStatus) {
						self.status(Data.Status);
						if (clearTimer) (clearTimeout(clearTimer), (clearTimer = undefined));

						if (Data.Status.clearTime) {
							clearTimer = setTimeout(() => {
								self.status({});
							}, Data.Status.clearTime);
						}
					}

					break;

				case 'EVENT':
					self.send({ payload: Data.Event });
					break;
			}
		};

		self.runtime.registerControllerNode(self.id, callback);

		const sendResponse = (msg, Req, Result, send, NodesCollection) => {
			const Return = getProfile(Req.cmd.method, Result, NodesCollection, Req.cmd.id);
			if (Return && Return.Type === 'RESPONSE') {
				send({ ...msg, payload: Return.Event });
			}
		};

		self.on('close', (_, done) => {
			self.runtime.deregisterControllerNode(self.id);
			done();
		});

		self.on('input', (msg, send, done) => {
			const CR = Check(msg);
			if (CR !== true) {
				callback({
					Type: 'STATUS',
					Status: {
						fill: 'red',
						shape: 'dot',
						text: 'Error',
						clearTime: 3000
					}
				});

				done(new Error(CR));
				return;
			}

			const Req = msg.payload;

			if (!MethodChecks[Req.cmd.api] || !MethodChecks[Req.cmd.api].includes(Req.cmd.method)) {
				done(new Error('The requested API is not available, or the method is not permitted.'));
				return;
			}

			switch (Req.cmd.api) {
				case 'DRIVER':
					self.runtime
						.driverCommand(Req.cmd.method, Req.cmdProperties?.args)
						.then((Result) => {
							sendResponse(msg, Req, Result, send, Req.cmdProperties?.nodeId);
						})
						.catch((Error) => {
							self.error(Error, msg);
						});
					done();
					break;

				case 'CONTROLLER':
					self.runtime
						.controllerCommand(Req.cmd.method, Req.cmdProperties?.args)
						.then((Result) => {
							sendResponse(msg, Req, Result, send, Req.cmdProperties?.nodeId);
						})
						.catch((Error) => {
							self.error(Error, msg);
						});
					done();
					break;

				case 'CC':
					self.runtime
						.ccCommand(
							Req.cmd.method,
							Req.cmdProperties.commandClass,
							Req.cmdProperties.method,
							Req.cmdProperties.nodeId,
							Req.cmdProperties.endpoint,
							Req.cmdProperties.args
						)
						.then((Result) => {
							sendResponse(msg, Req, Result, send, Req.cmdProperties?.nodeId);
						})
						.catch((Error) => {
							self.error(Error, msg);
						});
					done();

					break;

				case 'VALUE':
					self.runtime
						.valueCommand(
							Req.cmd.method,
							Req.cmdProperties.nodeId,
							Req.cmdProperties.valueId,
							Req.cmdProperties.value,
							Req.cmdProperties.setValueOptions
						)
						.then((Result) => {
							sendResponse(msg, Req, Result, send, Req.cmdProperties?.nodeId);
						})
						.catch((Error) => {
							self.error(Error, msg);
						});
					done();

					break;

				case 'NODE':
					self.runtime
						.nodeCommand(Req.cmd.method, Req.cmdProperties.nodeId, Req.cmdProperties.value)
						.then((Result) => {
							sendResponse(msg, Req, Result, send, Req.cmdProperties?.nodeId);
						})
						.catch((Error) => {
							self.error(Error, msg);
						});
					done();

					break;
			}
		});
	};

	RED.nodes.registerType('zwavejs-controller', init);
};
