const process = async function (DriverInstance, Method, CommandClass, CCMethod, NodeID, Endpoint, Args) {

	if (Array.isArray(NodeID)) {
		throw new Error('This API does not support Multicast');
	}

	if (Method === 'invokeCCAPI') {
		const Node = DriverInstance.controller.nodes.get(NodeID);
		if (Node) {
			return Node.getEndpoint(Endpoint || 0).invokeCCAPI(CommandClass, CCMethod, ...Args);
		} else {
			throw new Error(`Node ${NodeID} does not exist`);
		}
	}

	throw new Error('Invalid Method');
};

module.exports = { process };
