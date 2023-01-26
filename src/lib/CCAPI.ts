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
	let Result: unknown;

	if (Method === 'invokeCCAPI') {
		return new Promise((resolve, reject) => {
			try {
				Result = DriverInstance.controller.nodes
					.get(NodeID)
					?.getEndpoint(Endpoint || 0)
					?.invokeCCAPI(CommandClass, CCMethod, Args?.values());
				resolve(Result);
			} catch (Err) {
				reject(Err);
			}
		});
	}

	return Promise.reject(new Error('Invalid Method'));
};
