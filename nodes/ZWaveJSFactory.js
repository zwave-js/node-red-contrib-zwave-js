const { CommandClasses } = require('@zwave-js/core');

module.exports = (RED) => {
	const init = function (config) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;

		const evalExpression = (exp, msg) => {
			return new Promise((resolve, reject) => {
				RED.util.evaluateJSONataExpression(exp, msg, (err, value) => {
					if (err) reject(err);
					else resolve(value);
				});
			});
		};

		const ValueAPI = (msg, send, done) => {
			let ValueID;
			let Value;
			let NodeID;
			let Options;
			let TrackingID;

			(async () => {
				if (config.trackingId) {
					const EXP = RED.util.prepareJSONataExpression(config.trackingId, self);
					TrackingID = await evalExpression(EXP, msg);
				}

				if (config.valueId) {
					const EXP = RED.util.prepareJSONataExpression(config.valueId, self);
					ValueID = await evalExpression(EXP, msg);
				}

				if (config.nodeId) {
					const EXP = RED.util.prepareJSONataExpression(config.nodeId, self);
					NodeID = await evalExpression(EXP, msg);
				}

				if (config.method === 'setValue') {
					if (config.value) {
						const EXP = RED.util.prepareJSONataExpression(config.value, self);
						Value = await evalExpression(EXP, msg);
					}

					if (config.valueSetOptions) {
						const EXP = RED.util.prepareJSONataExpression(config.valueSetOptions, self);
						Options = await evalExpression(EXP, msg);
					}
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

				send({ payload: CMD });
				done();
			})();
		};

		const CCAPI = (msg, send, done) => {
			let NodeID;
			let Endpoint;
			let Args;
			let TrackingID;

			(async () => {
				if (config.trackingId) {
					const EXP = RED.util.prepareJSONataExpression(config.trackingId, self);
					TrackingID = await evalExpression(EXP, msg);
				}

				if (config.nodeId) {
					const EXP = RED.util.prepareJSONataExpression(config.nodeId, self);
					NodeID = await evalExpression(EXP, msg);
				}

				if (config.endpoint) {
					const EXP = RED.util.prepareJSONataExpression(config.endpoint, self);
					Endpoint = await evalExpression(EXP, msg);
				}

				if (config.args) {
					const EXP = RED.util.prepareJSONataExpression(config.args, self);
					Args = await evalExpression(EXP, msg);
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

				if (Endpoint !== undefined) {
					CMD.cmdProperties.endpoint = Endpoint;
				}

				if (Args) {
					CMD.cmdProperties.args = Args;
				}

				send({ payload: CMD });
				done();
			})();
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
