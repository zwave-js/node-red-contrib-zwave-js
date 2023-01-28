import { Driver } from 'zwave-js';
import { CommandClasses } from '@zwave-js/core';

export const process = async (
	DriverInstance: Driver,
	Method: string,
	NodeID: number,
	Value?: unknown
): Promise<unknown> => {
	if (Method === 'ping') {
		return new Promise((resolve, reject) => {
			DriverInstance.controller.nodes
				.get(NodeID)
				?.ping()
				.then((Result) => {
					resolve(Result);
				})
				.catch((Error) => {
					reject(Error);
				});
		});
	}

	if (Method === 'setNodeName') {
		return new Promise((resolve, reject) => {
			const Node = DriverInstance.controller.nodes.get(NodeID);
			if (Node) {
				try {
					const AsString = Value as string;
					Node.name = AsString;
					if (Node.supportsCC(CommandClasses['Node Naming and Location'])) {
						Node.commandClasses['Node Naming and Location'].setName(AsString);
					}
					resolve(AsString);
				} catch (Error) {
					reject(Error);
				}
			}
		});
	}

	if (Method === 'setLocation') {
		return new Promise((resolve, reject) => {
			const Node = DriverInstance.controller.nodes.get(NodeID);
			if (Node) {
				try {
					const AsString = Value as string;
					Node.location = AsString;
					if (Node.supportsCC(CommandClasses['Node Naming and Location'])) {
						Node.commandClasses['Node Naming and Location'].setLocation(AsString);
					}
					resolve(AsString);
				} catch (Error) {
					reject(Error);
				}
			}
		});
	}

	return Promise.reject(new Error('Invalid Method'));
};
