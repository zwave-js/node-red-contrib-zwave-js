const { getProfile } = require('./lib/RequestResponseProfiles');
const Limiter = require('limiter');
const MethodChecks = {
	CC: require('./lib/AllowedUsersCommands').CC,
	NODE: require('./lib/AllowedUsersCommands').Node,
	VALUE: require('./lib/AllowedUsersCommands').Value
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

		const LimiterSettings = {
			tokensPerInterval: 1,
			interval: Number(self.config.fanRate)
		};
		const RateLimiter = new Limiter.RateLimiter(LimiterSettings);

		const Nodes = config.nodeMode === 'All' ? [0] : config.filteredNodeId.split(',').map((N) => parseInt(N));
		self.runtime.registerDeviceNode(self.id, Nodes, callback);

		self.on('close', (_, done) => {
			self.runtime.deregisterDeviceNode(self.id);
			done();
		});

		self.on('input', (msg, send, done) => {
			const Req = msg.payload;

			if (!MethodChecks[Req.cmd.api].includes(Req.cmd.method)) {
				done(new Error('Sorry! This API method is limited to the UI only, or is an invalid method.'));
				return;
			}

			let TargetNodes;

			const run = (NodesCollection) => {
				console.log(NodesCollection);
				switch (Req.cmd.api) {
					case 'CC':
						if (Req.cmdProperties.commandClass && Req.cmdProperties.method) {
							self.runtime
								.ccCommand(
									Req.cmd.method,
									Req.cmdProperties.commandClass,
									Req.cmdProperties.method,
									NodesCollection,
									Req.cmdProperties.endpoint,
									Req.cmdProperties.args
								)
								.then((Result) => {
									const Return = getProfile(Req.cmd.method, Result, NodesCollection, Req.cmd.id);
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
							const Status = {
								Type: 'STATUS',
								Status: {
									fill: 'green',
									shape: 'dot',
									text: 'Sent',
									clearTime: 1000
								}
							};
							callback(Status);
						} else {
							done(new Error('cmdProperties is either missing or has fewer requied properties.'));
						}
						break;

					case 'VALUE':
						if (Req.cmdProperties.valueId) {
							self.runtime
								.valueCommand(
									Req.cmd.method,
									NodesCollection,
									Req.cmdProperties.valueId,
									Req.cmdProperties.value,
									Req.cmdProperties.setValueOptions
								)
								.then((Result) => {
									const Return = getProfile(Req.cmd.method, Result, NodesCollection, Req.cmd.id);
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
							const Status = {
								Type: 'STATUS',
								Status: {
									fill: 'green',
									shape: 'dot',
									text: 'Sent',
									clearTime: 1000
								}
							};
							callback(Status);
						} else {
							done(new Error('cmdProperties is either missing or has fewer requied properties.'));
						}
						break;

					case 'NODE':
						self.runtime
							.nodeCommand(Req.cmd.method, NodesCollection, Req.cmdProperties.value)
							.then((Result) => {
								const Return = getProfile(Req.cmd.method, Result, NodesCollection, Req.cmd.id);
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
						const Status = {
							Type: 'STATUS',
							Status: {
								fill: 'green',
								shape: 'dot',
								text: 'Sent',
								clearTime: 1000
							}
						};
						callback(Status);
						break;
				}
			};

			(async () => {
				if (self.config.nodeMode === 'All') {
					if (!Req.cmdProperties?.nodeId) {
						done(new Error('Missing cmdProperties.nodeId.'));
					} else {
						TargetNodes = Req.cmdProperties.nodeId;
						run(TargetNodes);
					}
				} else {
					TargetNodes = config.filteredNodeId.split(',').map((N) => parseInt(N));
					switch (self.config.multiMode) {
						case 'Multicast':
							run(TargetNodes);
							break;

						case 'Fan':
							for (let i = 0; i < TargetNodes.length; i++) {
								let Status = {
									Type: 'STATUS',
									Status: {
										fill: 'yellow',
										shape: 'dot',
										text: 'Throttling',
										clearTime: 10000
									}
								};
								callback(Status);
								await RateLimiter.removeTokens(1);
								run(TargetNodes[i]);
							}
							break;
					}
				}
			})();
		});
	};

	RED.nodes.registerType('zwavejs-device', init);
};
