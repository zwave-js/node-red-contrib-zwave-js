const { CommandClasses } = require('@zwave-js/core');
const { invokeMethod } = require('./Invoker');

const process = async function (DriverInstance, Method, NodeID, Value, Args) {
	if (Array.isArray(NodeID)) {
		return Promise.reject(new Error('This API does not support Multicast'));
	}

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
	const Params = Args || (Value !== undefined ? [Value] : []);
	return invokeMethod(Node, Method, Params)


};

module.exports = { process };
