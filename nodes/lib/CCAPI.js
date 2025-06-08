const process = async function (DriverInstance, Method, CommandClass, CCMethod, NodeID, Endpoint, Args) {
	if (Method === 'invokeCCAPI') {
		try {
			const Node = DriverInstance.controller.nodes.get(NodeID);
			if (Node) {
				return Node.getEndpoint(Endpoint || 0).invokeCCAPI(CommandClass, CCMethod, ...Args);
			} else {
				return Promise.reject(new Error(`Node ${NodeID} does not exist`));
			}
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	return Promise.reject(new Error('Invalid Method'));
};

module.exports = { process };
