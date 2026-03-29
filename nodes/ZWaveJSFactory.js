const { CommandClasses } = require('@zwave-js/core');

module.exports = (RED) => {
	const init = function (config) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;

		const evalExpression = (value, type, node, msg) => {
			return new Promise((resolve, reject) => {
				RED.util.evaluateNodeProperty(value, type, node, msg, (err, value) => {
					if (err) reject(err);
					else resolve(value);
				});
			});
		};

		const ValueAPI = async (msg, send, done) => {
			try {
				let TrackingID;
				let ValueID;
				let Value;
				let NodeID;
				let Options;

				if (config.trackingId) {
					TrackingID = await evalExpression(config.trackingId, config.trackingIdType, this, msg);
				}

				if (config.valueId) {
					ValueID = await evalExpression(config.valueId, config.valueIdType, this, msg);
				}

				if (config.method === 'setValue') {
					if (config.value !== undefined) {
						Value = await evalExpression(config.value, config.valueType, this, msg);
					}
					if (config.valueSetOptions) {
						Options = await evalExpression(config.valueSetOptions, config.valueSetOptionsType, this, msg);
					}
				}

				if (config.nodeId) {
					NodeID = await evalExpression(config.nodeId, config.nodeIdType, this, msg);
				}

				if (!ValueID) {
					done(new Error('Missing Value ID expression, or expression yields undefined.'));
					return;
				}

				if (!NodeID) {
					done(new Error('Missing Node ID expression, or expression yields undefined.'));
					return;
				}

				if (config.method === 'setValue' && Value === undefined) {
					done(new Error('Missing Value expression, or expression yields undefined.'));
					return;
				}

				const CMD = {
					cmd: {
						api: 'VALUE',
						method: config.method
					},
					cmdProperties: {
						nodeId: NodeID,
						valueId: ValueID
					}
				};

				if (TrackingID) {
					CMD.cmd.id = TrackingID;
				}

				if (Value !== undefined) {
					CMD.cmdProperties.value = Value;
				}

				if (Options) {
					CMD.cmdProperties.setValueOptions = Options;
				}

				send({ ...msg, payload: CMD });
				done();
			} catch (error) {
				done(error);
			}
		};

		const CCAPI = async (msg, send, done) => {
			try {
				let TrackingID;
				let NodeID;
				let Endpoint;
				let Args;

				if (config.trackingId) {
					TrackingID = await evalExpression(config.trackingId, config.trackingIdType, this, msg);
				}

				if (config.nodeId) {
					NodeID = await evalExpression(config.nodeId, config.nodeIdType, this, msg);
				}

				if (config.endpoint) {
					Endpoint = await evalExpression(config.endpoint, config.endpointType, this, msg);
				}

				if (config.args) {
					Args = await evalExpression(config.args, config.argsType, this, msg);
				}

				if (!NodeID) {
					done(new Error('Missing Node ID expression, or expression yields undefined.'));
					return;
				}

				if (!config.commandClass) {
					done(new Error('Missing Command Class.'));
					return;
				}

				if (!config.method) {
					done(new Error('Missing Command Class method.'));
					return;
				}

				const CMD = {
					cmd: {
						api: 'CC',
						method: 'invokeCCAPI'
					},
					cmdProperties: {
						nodeId: NodeID,
						method: config.method,
						commandClass: CommandClasses[config.commandClass]
					}
				};

				if (TrackingID) {
					CMD.cmd.id = TrackingID;
				}

				if (Endpoint) {
					CMD.cmdProperties.endpoint = Endpoint;
				}

				if (Args) {
					CMD.cmdProperties.args = Args;
				}

				send({ ...msg, payload: CMD });
				done();
			} catch (error) {
				done(error);
			}
		};

		self.on('input', (msg, send, done) => {
			switch (config.api) {
				case 'VALUE':
					ValueAPI(msg, send, done);
					break;
				case 'CC':
					CCAPI(msg, send, done);
					break;
			}
		});

		self.on('close', (_, done) => {
			done();
		});
	};

	RED.nodes.registerType('zwavejs-factory', init);
};
