const process = async function (DriverInstance, Method, NodeID, VID, Value, ValueOptions) {
	if (Method === 'getValue') {
		const Node = DriverInstance.controller.nodes.get(NodeID);
		if (Node) {
			return Node.getValue(VID);
		} else {
			return Promise.reject(new Error(`Node ${NodeID} does not exist`));
		}
	}

	if (Method === 'setValue') {
		const Node = DriverInstance.controller.nodes.get(NodeID);
		if (Node) {
			return Node.setValue(VID, Value, ValueOptions);
		} else {
			return Promise.reject(new Error(`Node ${NodeID} does not exist`));
		}
	}

	if (Method === 'pollValue') {
		const Node = DriverInstance.controller.nodes.get(NodeID);
		if (Node) {
			return Node.pollValue(VID);
		} else {
			return Promise.reject(new Error(`Node ${NodeID} does not exist`));
		}
	}

	return Promise.reject(new Error('Invalid Method'));
};

module.exports = { process };
