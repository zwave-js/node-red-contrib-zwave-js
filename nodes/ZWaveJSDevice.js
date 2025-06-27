const { getProfile } = require('./lib/RequestResponseProfiles');
const AllowedNodeCommands = require('./lib/AllowedUsersCommands').Node;
const AllowedValueCommands = require('./lib/AllowedUsersCommands').Value;
const AllowedCCCommands = require('./lib/AllowedUsersCommands').CC;

module.exports = (RED) => {
	const init = function (config) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;
		self.runtime = RED.nodes.getNode(self.config.runtimeId);

		const callback = (Data) => {
			switch (Data.Type) {
				case 'STATUS':
					self.status(Data.Status);
					if (Data.Status.clearTime) {
						setTimeout(() => {
							self.status({});
						}, Data.Status.clearTime);
					}
					break;

				case 'EVENT':
					self.send({ payload: Data.Event });
					break;
			}
		};

		self.runtime.registerDeviceNode(self.id, undefined, callback);

		self.on('close', (_, done) => {
			self.runtime.deregisterDeviceNode(self.id);
			done();
		});

		const sendTrackingUpdate = (Req, Response) => {
			if (Req.cmd.trackingToken !== undefined) {
				const Timestamp = new Date().getTime();
				const TrackingResponse = {
					event: 'TRACKING_TOKEN_RETURN',
					timestamp: Timestamp,
					eventBody: {
						token: Req.cmd.trackingToken,
						response: Response
					}
				};
				self.send({ payload: TrackingResponse });
			}
		};

		self.on('input', (msg, send, done) => {
			const Req = msg.payload;

			if (self.config.nodeMode === 'All' && !Req.cmdProperties?.nodeId) {
				done(new Error('Missing cmdProperties.nodeId property.'));
				return;
			}

			if (Req.cmdProperties?.nodeId) {
				switch (Req.cmd.api) {
					case 'CC':
						if (!AllowedCCCommands.includes(Req.cmd.method)) {
							done(new Error('Sorry! This method is limited to the UI only, or is an invalid method.'));
							return;
						}
						if (Req.cmdProperties.commandClass && Req.cmdProperties.method && Req.cmdProperties.nodeId) {
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
									sendTrackingUpdate(Req, Result);
									const Return = getProfile(Req.cmd.method, Result, Req.cmdProperties.nodeId);
									if (Return && Return.Type === 'RESPONSE') {
										send({ payload: Return.Event });
										done();
									} else {
										done();
									}
								})
								.catch((Error) => {
									sendTrackingUpdate(Req, Error);
									done(Error);
								});
						} else {
							done(new Error('cmdProperties is either missing or has fewer requied properties.'));
						}
						break;

					case 'VALUE':
						if (!AllowedValueCommands.includes(Req.cmd.method)) {
							done(new Error('Sorry! This method is limited to the UI only, or is an invalid method.'));
							return;
						}
						if (Req.cmdProperties.nodeId && Req.cmdProperties.valueId) {
							self.runtime
								.valueCommand(
									Req.cmd.method,
									Req.cmdProperties.nodeId,
									Req.cmdProperties.valueId,
									Req.cmdProperties.value,
									Req.cmdProperties.setValueOptions
								)
								.then((Result) => {
									sendTrackingUpdate(Req, Result);
									const Return = getProfile(Req.cmd.method, Result, Req.cmdProperties.nodeId);
									if (Return && Return.Type === 'RESPONSE') {
										send({ payload: Return.Event });
										done();
									} else {
										done();
									}
								})
								.catch((Error) => {
									sendTrackingUpdate(Req, Error);
									done(Error);
								});
						} else {
							done(new Error('cmdProperties is either missing or has fewer requied properties.'));
						}
						break;

					case 'NODE':
						if (!AllowedNodeCommands.includes(Req.cmd.method)) {
							done(new Error('Sorry! This method is limited to the UI only, or is an invalid method.'));
							return;
						}
						self.runtime
							.nodeCommand(Req.cmd.method, Req.cmdProperties.nodeId, Req.cmdProperties.value)
							.then((Result) => {
								sendTrackingUpdate(Req, Result);
								const Return = getProfile(Req.cmd.method, Result, Req.cmdProperties.nodeId);
								if (Return && Return.Type === 'RESPONSE') {
									send({ payload: Return.Event });
									done();
								} else {
									done();
								}
							})
							.catch((Error) => {
								sendTrackingUpdate(Req, Error);
								done(Error);
							});
						break;
				}
			}
		});
	};

	RED.nodes.registerType('zwavejs-device', init);
};
