const { getProfile } = require('./lib/RequestResponseProfiles');
const MethodChecks = {
	CC: require('./lib/AllowedUsersCommands').CC,
	NODE: require('./lib/AllowedUsersCommands').Node,
	VALUE: require('./lib/AllowedUsersCommands').Value,
	CONTROLLER: require('./lib/AllowedUsersCommands').Controller,
	DRIVER: require('./lib/AllowedUsersCommands').Controller
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
					self.status(Data.Status);
					if (clearTimer) (clearTimeout(clearTimer), (clearTimer = undefined));

					if (Data.Status.clearTime) {
						clearTimer = setTimeout(() => {
							self.status({});
						}, Data.Status.clearTime);
					}
					break;

				case 'EVENT':
					self.send({ payload: Data.Event });
					break;
			}
		};

		self.runtime.registerControllerNode(self.id, callback);

		self.on('close', (_, done) => {
			self.runtime.deregisterControllerNode(self.id);
			done();
		});

		self.on('input', (msg, send, done) => {
			const Req = msg.payload;

			if (!MethodChecks[Req.cmd.api].includes(Req.cmd.method)) {
				done(new Error('Sorry! This API method is limited to the UI only, or is an invalid method.'));
				return;
			}

			if (Req.cmd) {
				switch (Req.cmd.api) {
					case 'DRIVER':
						self.runtime
							.driverCommand(Req.cmd.method, Req.cmdProperties?.args)
							.then((Result) => {
								const Return = getProfile(Req.cmd.method, Result, Req.cmdProperties?.nodeId, Req.cmd.id);
								if (Return && Return.Type === 'RESPONSE') {
									send({ payload: Return.Event });
									done();
								} else {
									done();
								}
							})
							.catch((Error) => {
								done(Error);
							});
						break;

					case 'CONTROLLER':
						self.runtime
							.controllerCommand(Req.cmd.method, Req.cmdProperties?.args)
							.then((Result) => {
								const Return = getProfile(Req.cmd.method, Result, Req.cmdProperties?.nodeId, Req.cmd.id);
								if (Return && Return.Type === 'RESPONSE') {
									send({ payload: Return.Event });
									done();
								} else {
									done();
								}
							})
							.catch((Error) => {
								done(Error);
							});
						break;

					case 'CC':
						if (Req.cmdProperties?.commandClass && Req.cmdProperties?.method && Req.cmdProperties?.nodeId) {
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
									const Return = getProfile(Req.cmd.method, Result, Req.cmdProperties?.nodeId, Req.cmd.id);
									if (Return && Return.Type === 'RESPONSE') {
										send({ payload: Return.Event });
										done();
									} else {
										done();
									}
								})
								.catch((Error) => {
									done(Error);
								});
						} else {
							done(new Error('cmdProperties is either missing or has fewer required properties.'));
						}
						break;

					case 'VALUE':
						if (Req.cmdProperties?.nodeId && Req.cmdProperties?.valueId) {
							self.runtime
								.valueCommand(
									Req.cmd.method,
									Req.cmdProperties.nodeId,
									Req.cmdProperties.valueId,
									Req.cmdProperties.value,
									Req.cmdProperties.setValueOptions
								)
								.then((Result) => {
									const Return = getProfile(Req.cmd.method, Result, Req.cmdProperties?.nodeId, Req.cmd.id);
									if (Return && Return.Type === 'RESPONSE') {
										send({ payload: Return.Event });
										done();
									} else {
										done();
									}
								})
								.catch((Error) => {
									done(Error);
								});
						} else {
							done(new Error('cmdProperties is either missing or has fewer required properties.'));
						}
						break;

					case 'NODE':
						if (Req.cmdProperties?.nodeId) {
							self.runtime
								.nodeCommand(Req.cmd.method, Req.cmdProperties.nodeId, Req.cmdProperties.value)
								.then((Result) => {
									const Return = getProfile(Req.cmd.method, Result, Req.cmdProperties?.nodeId, Req.cmd.id);
									if (Return && Return.Type === 'RESPONSE') {
										send({ payload: Return.Event });
										done();
									} else {
										done();
									}
								})
								.catch((Error) => {
									done(Error);
								});
						} else {
							done(new Error('Missing cmdProperties.nodeId property.'));
						}
						break;
				}
			} else {
				done(new Error('msg.payload is not a valid command.'));
			}
		});
	};

	RED.nodes.registerType('zwavejs-controller', init);
};
