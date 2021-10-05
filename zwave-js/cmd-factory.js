module.exports = function (RED) {
	function Init(config) {
		RED.nodes.createNode(this, config);
		const RedNode = this;

		RedNode.on('input', Input);
		async function Input(msg, send, done) {
			try {
				const API = config.api || 'CCAPI';
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

			if (typeof ValueID !== 'object') {
				throw new Error(
					'[ValueID] does not evaluate to an object. Evaluated type: ' +
						typeof ValueID
				);
			}
			if (Endpoint !== undefined) {
				ValueID.endpoint = Endpoint;
			}
			if (config.vapiMode === 'setValue' && Value === undefined) {
				throw new Error('[Value] is missing');
			}
			if (Options !== undefined && typeof Options !== 'object') {
				throw new Error(
					'[Set Options] do not evaluate to an object. Evaluated type: ' +
						typeof Options
				);
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

			if (send) {
				send({ payload: RM });
			} else {
				RedNode.send({ payload: RM });
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

			if (Params !== undefined && !Array.isArray(Params)) {
				throw new Error(
					'[Params] do not evaluate to an array. Evaluated type: ' +
						typeof Params
				);
			}
			if (ForceUpdate !== undefined && typeof ForceUpdate !== 'object') {
				throw new Error(
					'[Force Update] does not evaluate to an object. Evaluated type: ' +
						typeof ForceUpdate
				);
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

			if (send) {
				send({ payload: RM });
			} else {
				RedNode.send({ payload: RM });
			}
		}
	}

	RED.nodes.registerType('cmd-factory', Init);
};
