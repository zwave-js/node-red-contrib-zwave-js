const { CommandClasses } = require('@zwave-js/core');

const process = async function (DriverInstance, Method, NodeID, Value, Args) {
	const Node = DriverInstance.controller.nodes.get(NodeID);
	if (!Node) {
		return Promise.reject(new Error(`Node ${NodeID} does not exist`));
	}

	if (Method === 'setName') {
		try {
			Node.name = Value;
			if (Node.supportsCC(CommandClasses['Node Naming and Location'])) {
				Node.commandClasses['Node Naming and Location'].setName(Value);
			}
			return Value;
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'setLocation') {
		try {
			Node.location = Value;
			if (Node.supportsCC(CommandClasses['Node Naming and Location'])) {
				Node.commandClasses['Node Naming and Location'].setLocation(Value);
			}
			return Value;
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	/* Dynamic */

	const _Method = Node[Method];
	if (!_Method) {
		return Promise.reject(new Error('Invalid Method'));
	}
	const Params = Args || (Value !== undefined ? [Value] : []);
	return _Method.apply(Node, Params);
};

module.exports = { process };
