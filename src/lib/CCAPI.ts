import { Driver } from 'zwave-js';
import { CommandClasses } from '@zwave-js/core';

export const process = async (
	DriverInstance: Driver,
	Method: string,
	CommandClass: CommandClasses,
	CCMethod: string,
	NodeID: number,
	Endpoint?: number,
	Args?: unknown[]
): Promise<unknown> => {
	if (Method === 'invokeCCAPI') {
		try {
			const Node = DriverInstance.controller.nodes.get(NodeID);
			if (Node) {
				return Node.getEndpoint(Endpoint || 0)?.invokeCCAPI(CommandClass, CCMethod, Args?.values());
			} else {
				return Promise.reject(new Error(`Node ${NodeID} does not exist`));
			}
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	return Promise.reject(new Error('Invalid Method'));
};
