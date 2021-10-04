module.exports = function (RED) {
	function Init(config) {
		RED.nodes.createNode(this, config);
		const RedNode = this;

		RedNode.on('input', Input);
		async function Input(msg, send, done) {
			try {
				let NodeID = undefined;
				let Endpoint = undefined;
				let Params = undefined;
				let NoEvent = false;
				let ForceUpdate = undefined;

				if (config.noEvent !== undefined) {
					NoEvent = config.noEvent;
				}

				if (config.node !== undefined && config.node.length > 0) {
					const EXP = RED.util.prepareJSONataExpression(config.node, RedNode);
					NodeID = RED.util.evaluateJSONataExpression(EXP, msg);
				}

				if (config.endpoint !== undefined && config.endpoint.length > 0) {
					const EXP = RED.util.prepareJSONataExpression(
						config.endpoint,
						RedNode
					);
					Endpoint = RED.util.evaluateJSONataExpression(EXP, msg);
				}
				if (config.params !== undefined && config.params.length > 0) {
					const EXP = RED.util.prepareJSONataExpression(config.params, RedNode);
					Params = RED.util.evaluateJSONataExpression(EXP, msg);

					if (Params !== undefined && !Array.isArray(Params)) {
						if (done) {
							done(
								new Error(
									'Params do not evaluate to an Array object. evaulted type : ' +
										typeof Params
								)
							);
						} else {
							RedNode.error(
								new Error(
									'Params do not evaluate to an Array object. evaulted type : ' +
										typeof Params
								)
							);
						}

						return;
					}
				}

				if (config.forceUpdate !== undefined && config.forceUpdate.length > 0) {
					const EXP = RED.util.prepareJSONataExpression(
						config.forceUpdate,
						RedNode
					);
					ForceUpdate = RED.util.evaluateJSONataExpression(EXP, msg);
				}

				const RM = {};
				RM.mode = 'CCAPI';
				RM.cc = config.cc;
				RM.method = config.method;
				RM.responseThroughEvent = NoEvent !== true;

				if (ForceUpdate !== undefined) {
					RM.forceUpdate = ForceUpdate;
				}

				if (NodeID !== undefined) {
					RM.node = NodeID;
				}
				if (Endpoint !== undefined) {
					RM.endpoint = Endpoint;
				}
				if (Params !== undefined) {
					RM.params = Params;
				}

				if (send) {
					send({ payload: RM });
				} else {
					RedNode.send({ payload: RM });
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
	}

	RED.nodes.registerType('cmd-factory', Init);
};
