const process = async function (DriverInstance, Method, NodeID, VID, Value, ValueOptions) {
	let Node;
	if (Array.isArray(NodeID)) {
		Node = DriverInstance.controller.getMulticastGroup(NodeID);
	} else {
		Node = DriverInstance.controller.nodes.get(NodeID);
	}

	if (!Node) {
		return Promise.reject(new Error(`Node ${NodeID} does not exist`));
	}

	const _Method = Node[Method];
	if (!_Method) {
		return Promise.reject(new Error('Invalid Method'));
	}

	switch (Method) {
		case 'getValue':
		case 'pollValue':
			return _Method.apply(Node, [VID]);

		case 'setValue':
			return _Method.apply(Node, [VID, Value, ValueOptions]);
	}
};

module.exports = { process };
