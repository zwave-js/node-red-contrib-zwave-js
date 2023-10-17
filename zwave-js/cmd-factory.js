module.exports = function (RED) {
	function Init(config) {
		RED.nodes.createNode(this, config);
		const RedNode = this;

		RedNode.on('input', Input);
		async function Input(msg, send, done) {
			try {
				const API = config.api || 'ValueAPI';
				switch (API) {
					case 'CCAPI':
						await CCAPI(msg, send);
						break;
					case 'ValueAPI':
						await ValueAPI(msg, send);
						break;
				}
				if (done) {
					done();
				}
			} catch (Err) {
				const E = new Error(Err.message);
				if (done) {
					done(E);
				} else {
					RedNode.error(E);
				}
				return;
			}
		}

		let _AwaiterResolver;
		const Awaiter = () => {
			return new Promise((Resolve) => {
				_AwaiterResolver = Resolve;
			});
		};

		async function ValueAPI(msg, send) {
			let NodeID = undefined;
			let Endpoint = undefined;
			let Value = undefined;
			let ValueID = undefined;
			let Options = undefined;

			let Waiter;

			if (config.node !== undefined && config.node.length > 0) {
				Waiter = Awaiter();
				const EXP = RED.util.prepareJSONataExpression(config.node, RedNode);
				RED.util.evaluateJSONataExpression(EXP, msg, (Err, Res) => {
					NodeID = Res;
					_AwaiterResolver();
				});
				await Promise.all([Waiter]);
			}

			if (config.endpoint !== undefined && config.endpoint.length > 0) {
				Waiter = Awaiter();
				const EXP = RED.util.prepareJSONataExpression(config.endpoint, RedNode);
				RED.util.evaluateJSONataExpression(EXP, msg, (Err, Res) => {
					Endpoint = Res;
					_AwaiterResolver();
				});
				await Promise.all([Waiter]);
			}

			if (config.vapiValueId !== undefined && config.vapiValueId.length > 0) {
				Waiter = Awaiter();
				const EXP = RED.util.prepareJSONataExpression(
					config.vapiValueId,
					RedNode
				);
				RED.util.evaluateJSONataExpression(EXP, msg, (Err, Res) => {
					ValueID = Res;
					_AwaiterResolver();
				});
				await Promise.all([Waiter]);
			}

			if (config.vapiOptions !== undefined && config.vapiOptions.length > 0) {
				Waiter = Awaiter();
				const EXP = RED.util.prepareJSONataExpression(
					config.vapiOptions,
					RedNode
				);
				RED.util.evaluateJSONataExpression(EXP, msg, (Err, Res) => {
					Options = Res;
					_AwaiterResolver();
				});
				await Promise.all([Waiter]);
			}

			if (config.vapiValue !== undefined && config.vapiValue.length > 0) {
				Waiter = Awaiter();
				const EXP = RED.util.prepareJSONataExpression(
					config.vapiValue,
					RedNode
				);
				RED.util.evaluateJSONataExpression(EXP, msg, (Err, Res) => {
					Value = Res;
					_AwaiterResolver();
				});
				await Promise.all([Waiter]);
			}

			if (ValueID === undefined) {
				throw new Error('[ValueID] is missing.');
			} else if (typeof ValueID !== 'object' || Array.isArray(ValueID)) {
				throw new Error('[ValueID] does not evaluate to an object.');
			}

			if (Endpoint !== undefined) {
				ValueID.endpoint = Endpoint;
			}
			if (config.vapiMode === 'setValue' && Value === undefined) {
				throw new Error('[Value] is missing');
			}
			if (Options !== undefined) {
				if (typeof Options !== 'object' || Array.isArray(Options)) {
					throw new Error('[Set Options] do not evaluate to an object.');
				}
			}

			const RM = {
				cmd: {
					api: 'VALUE',
					method: config.vapiMode
				},
				cmdProperties: {
					nodeId: NodeID,
					value: Value,
					valueId: ValueID,
					setValueOptions: Options
				}
			};

			msg.payload = RM;

			if (send) {
				send(msg);
			} else {
				RedNode.send(msg);
			}
		}

		async function CCAPI(msg, send) {
			let NodeID = undefined;
			let Endpoint = undefined;
			let Params = undefined;
			const NoEvent = config.noEvent || false;
			let ForceUpdate = undefined;

			let Waiter;

			if (config.node !== undefined && config.node.length > 0) {
				Waiter = Awaiter();
				const EXP = RED.util.prepareJSONataExpression(config.node, RedNode);
				RED.util.evaluateJSONataExpression(EXP, msg, (Err, Res) => {
					NodeID = Res;
					_AwaiterResolver();
				});
				await Promise.all([Waiter]);
			}

			if (config.endpoint !== undefined && config.endpoint.length > 0) {
				Waiter = Awaiter();
				const EXP = RED.util.prepareJSONataExpression(config.endpoint, RedNode);
				RED.util.evaluateJSONataExpression(EXP, msg, (Err, Res) => {
					Endpoint = Res;
					_AwaiterResolver();
				});
				await Promise.all([Waiter]);
			}

			if (config.params !== undefined && config.params.length > 0) {
				Waiter = Awaiter();
				const EXP = RED.util.prepareJSONataExpression(config.params, RedNode);
				RED.util.evaluateJSONataExpression(EXP, msg, (Err, Res) => {
					Params = Res;
					_AwaiterResolver();
				});
				await Promise.all([Waiter]);
			}

			if (config.forceUpdate !== undefined && config.forceUpdate.length > 0) {
				Waiter = Awaiter();
				const EXP = RED.util.prepareJSONataExpression(
					config.forceUpdate,
					RedNode
				);
				RED.util.evaluateJSONataExpression(EXP, msg, (Err, Res) => {
					ForceUpdate = Res;
					_AwaiterResolver();
				});
				await Promise.all([Waiter]);
			}

			if (Params !== undefined) {
				if (!Array.isArray(Params)) {
					throw new Error('[Params] do not evaluate to an array.');
				}
			}

			if (ForceUpdate !== undefined) {
				if (typeof ForceUpdate !== 'object' || Array.isArray(ForceUpdate)) {
					throw new Error('[Force Update] does not evaluate to an object.');
				}
			}

			const RM = {
				cmd: {
					api: 'CC',
					method: 'invokeCCAPI'
				},
				cmdProperties: {
					nodeId: NodeID,
					endpoint: Endpoint,
					commandClass: config.cc,
					method: config.method,
					args: Params
				},
				responseThroughEvent: NoEvent !== true,
				forceUpdate: ForceUpdate
			};

			msg.payload = RM;

			if (send) {
				send(msg);
			} else {
				RedNode.send(msg);
			}
		}
	}

	RED.nodes.registerType('cmd-factory', Init);
};
