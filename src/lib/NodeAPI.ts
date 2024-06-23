import { Driver } from 'zwave-js';
import { CommandClasses } from '@zwave-js/core';

export const process = async (
	DriverInstance: Driver,
	Method: string,
	NodeID: number,
	Value?: unknown
): Promise<unknown> => {
	if (Method === 'ping') {
		const Node = DriverInstance.controller.nodes.get(NodeID);
		if (Node) {
			return DriverInstance.controller.nodes.get(NodeID)?.ping();
		} else {
			return Promise.reject(new Error(`Node ${NodeID} does not exist`));
		}
	}

	if (Method === 'refreshInfo') {
		const Node = DriverInstance.controller.nodes.get(NodeID);
		if (Node) {
			try {
				await Node.refreshInfo()
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
				const AsString = Value as string;
				Node.name = AsString;
				if (Node.supportsCC(CommandClasses['Node Naming and Location'])) {
					Node.commandClasses['Node Naming and Location'].setName(AsString);
				}
				return AsString;
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
				const AsString = Value as string;
				Node.location = AsString;
				if (Node.supportsCC(CommandClasses['Node Naming and Location'])) {
					Node.commandClasses['Node Naming and Location'].setLocation(AsString);
				}
				return AsString;
			} catch (Err) {
				return Promise.reject(Err);
			}
		} else {
			return Promise.reject(new Error(`Node ${NodeID} does not exist`));
		}
	}

	return Promise.reject(new Error('Invalid Method'));
};
