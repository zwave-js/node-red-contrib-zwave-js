const { invokeMethod } = require('./Invoker');

const process = async function (DriverInstance, Method, NodeID, VID, Value, ValueOptions) {
	let Node;
	if (Array.isArray(NodeID)) {
		Node = DriverInstance.controller.getMulticastGroup(NodeID);
	} else {
		Node = DriverInstance.controller.nodes.get(NodeID);
	}

	if (!Node) {
		throw new Error(`Node ${NodeID} does not exist`);
	}

	const Args = Method === 'setValue' ? [VID, Value, ValueOptions] : [VID]
	return invokeMethod(Node, Method, Args)

};

module.exports = { process };
