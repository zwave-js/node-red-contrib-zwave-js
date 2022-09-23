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
						CCAPI(msg, send);
						break;
					case 'ValueAPI':
						ValueAPI(msg, send);
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

		function ValueAPI(msg, send) {
			let NodeID = undefined;
			let Endpoint = undefined;
			let Value = undefined;
			let ValueID = undefined;
			let Options = undefined;

			if (config.node !== undefined && config.node.length > 0) {
				const EXP = RED.util.prepareJSONataExpression(config.node, RedNode);
				NodeID = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (config.endpoint !== undefined && config.endpoint.length > 0) {
				const EXP = RED.util.prepareJSONataExpression(config.endpoint, RedNode);
				Endpoint = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (config.vapiValueId !== undefined && config.vapiValueId.length > 0) {
				const EXP = RED.util.prepareJSONataExpression(
					config.vapiValueId,
					RedNode
				);
				ValueID = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (config.vapiOptions !== undefined && config.vapiOptions.length > 0) {
				const EXP = RED.util.prepareJSONataExpression(
					config.vapiOptions,
					RedNode
				);
				Options = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (config.vapiValue !== undefined && config.vapiValue.length > 0) {
				const EXP = RED.util.prepareJSONataExpression(
					config.vapiValue,
					RedNode
				);
				Value = RED.util.evaluateJSONataExpression(EXP, msg);
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

			const RM = {};
			RM.mode = 'ValueAPI';
			RM.method = config.vapiMode;
			RM.node = NodeID;
			RM.params = [];
			RM.params.push(ValueID);
			if (config.vapiMode === 'setValue') {
				RM.params.push(Value);
				if (Options !== undefined) {
					RM.params.push(Options);
				}
			}

			if (RM.params.length < 1) {
				delete RM['params'];
			}

			Object.keys(RM).forEach((K) => {
				if (typeof RM[K] === 'undefined') {
					delete RM[K];
				}
			});

			msg.payload = RM;

			if (send) {
				send(msg);
			} else {
				RedNode.send(msg);
			}
		}

		function CCAPI(msg, send) {
			let NodeID = undefined;
			let Endpoint = undefined;
			let Params = undefined;
			const NoEvent = config.noEvent || false;
			let ForceUpdate = undefined;

			if (config.node !== undefined && config.node.length > 0) {
				const EXP = RED.util.prepareJSONataExpression(config.node, RedNode);
				NodeID = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (config.endpoint !== undefined && config.endpoint.length > 0) {
				const EXP = RED.util.prepareJSONataExpression(config.endpoint, RedNode);
				Endpoint = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (config.params !== undefined && config.params.length > 0) {
				const EXP = RED.util.prepareJSONataExpression(config.params, RedNode);
				Params = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (config.forceUpdate !== undefined && config.forceUpdate.length > 0) {
				const EXP = RED.util.prepareJSONataExpression(
					config.forceUpdate,
					RedNode
				);
				ForceUpdate = RED.util.evaluateJSONataExpression(EXP, msg);
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

			const RM = {};
			RM.mode = 'CCAPI';
			RM.cc = config.cc;
			RM.method = config.method;
			RM.responseThroughEvent = NoEvent !== true;
			RM.node = NodeID;
			RM.endpoint = Endpoint;
			RM.params = Params;
			if (ForceUpdate !== undefined) {
				RM.forceUpdate = ForceUpdate;
			}

			Object.keys(RM).forEach((K) => {
				if (typeof RM[K] === 'undefined') {
					delete RM[K];
				}
			});

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
