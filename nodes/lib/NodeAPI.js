const { CommandClasses } = require('@zwave-js/core');

const process = async function (DriverInstance, Method, NodeID, Value) {
	if (Method === 'ping') {
		const Node = DriverInstance.controller.nodes.get(NodeID);
		if (Node) {
			return Node.ping();
		} else {
			return Promise.reject(new Error(`Node ${NodeID} does not exist`));
		}
	}

	if (Method === 'refreshInfo') {
		const Node = DriverInstance.controller.nodes.get(NodeID);
		if (Node) {
			try {
				await Node.refreshInfo();
				return true;
			} catch (Err) {
				return Promise.reject(Err);
			}
		} else {
			return Promise.reject(new Error(`Node ${NodeID} does not exist`));
		}
	}

	if (Method === 'setName') {
		const Node = DriverInstance.controller.nodes.get(NodeID);
		if (Node) {
			try {
				Node.name = Value;
				if (Node.supportsCC(CommandClasses['Node Naming and Location'])) {
					Node.commandClasses['Node Naming and Location'].setName(Value);
				}
				return Value;
			} catch (Err) {
				return Promise.reject(Err);
			}
		} else {
			return Promise.reject(new Error(`Node ${NodeID} does not exist`));
		}
	}

	if (Method === 'setLocation') {
		const Node = DriverInstance.controller.nodes.get(NodeID);
		if (Node) {
			try {
				Node.location = Value;
				if (Node.supportsCC(CommandClasses['Node Naming and Location'])) {
					Node.commandClasses['Node Naming and Location'].setLocation(Value);
				}
				return Value;
			} catch (Err) {
				return Promise.reject(Err);
			}
		} else {
			return Promise.reject(new Error(`Node ${NodeID} does not exist`));
		}
	}

	return Promise.reject(new Error('Invalid Method'));
};

module.exports = { process };
