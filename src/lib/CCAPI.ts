import { Driver } from 'zwave-js';
import { CommandClasses } from '@zwave-js/core';

export const process = async (
	DriverInstance: Driver,
	CC: CommandClasses,
	CCMethod: string,
	NodeID: number,
	Endpoint?: number,
	Argumnets?: any[]
): Promise<any> => {
	let Result: any;
	return new Promise((resolve, reject) => {
		try {
			DriverInstance.controller.nodes
				.get(NodeID)
				?.getEndpoint(Endpoint || 0)
				?.invokeCCAPI(CC, CCMethod, Argumnets?.values());
			resolve(Result);
		} catch (Err) {
			reject(Err);
		}
	});
};
