import { Driver, ValueID } from 'zwave-js';

export const process = async (
	DriverInstance: Driver,
	Method: string,
	NodeID: number,
	VID: ValueID,
	Value?: any,
	ValueOptions?: Record<string, any>
): Promise<any> => {
	let Result: any;
	switch (Method) {
		case 'getValue':
			return new Promise((resolve, reject) => {
				try {
					Result = DriverInstance.controller.nodes.get(NodeID)?.getValue(VID);
					resolve(Result);
				} catch (Err) {
					reject(Err);
				}
			});

		case 'setValue':
			return new Promise((resolve, reject) => {
				DriverInstance.controller.nodes
					.get(NodeID)
					?.setValue(VID, Value, ValueOptions)
					.then((Result) => {
						resolve(Result);
					})
					.catch((Error) => {
						reject(Error);
					});
			});

		case 'pollValue':
			return new Promise((resolve, reject) => {
				DriverInstance.controller.nodes
					.get(NodeID)
					?.pollValue(VID)
					.then((Result) => {
						resolve(Result);
					})
					.catch((Error) => {
						reject(Error);
					});
			});
	}
};
