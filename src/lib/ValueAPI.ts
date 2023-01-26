import { Driver, ValueID } from 'zwave-js';

export const process = async (
	DriverInstance: Driver,
	Method: string,
	NodeID: number,
	VID: ValueID,
	Value?: unknown,
	ValueOptions?: Record<string, unknown>
): Promise<unknown> => {
	let Result: unknown;

	if (Method === 'getValue') {
		return new Promise((resolve, reject) => {
			try {
				Result = DriverInstance.controller.nodes.get(NodeID)?.getValue(VID);
				resolve(Result);
			} catch (Err) {
				reject(Err);
			}
		});
	}

	if (Method === 'setValue') {
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
	}

	if (Method === 'pollValue') {
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

	return Promise.reject(new Error('Invalid Method'));
};
