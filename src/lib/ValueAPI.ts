import { Driver, ValueID } from 'zwave-js';

export const process = async (
	DriverInstance: Driver,
	Method: string,
	NodeID: number,
	VID: ValueID,
	Value?: unknown,
	ValueOptions?: Record<string, unknown>
): Promise<unknown> => {
	if (Method === 'getValue') {
		const Node = DriverInstance.controller.nodes.get(NodeID);
		if (Node) {
			return DriverInstance.controller.nodes.get(NodeID)?.getValue(VID);
		} else {
			return Promise.reject(new Error(`Node ${NodeID} does not exist`));
		}
	}

	if (Method === 'setValue') {
		const Node = DriverInstance.controller.nodes.get(NodeID);
		if (Node) {
			return DriverInstance.controller.nodes.get(NodeID)?.setValue(VID, Value, ValueOptions);
		} else {
			return Promise.reject(new Error(`Node ${NodeID} does not exist`));
		}
	}

	if (Method === 'pollValue') {
		const Node = DriverInstance.controller.nodes.get(NodeID);
		if (Node) {
			return DriverInstance.controller.nodes.get(NodeID)?.pollValue(VID);
		} else {
			return Promise.reject(new Error(`Node ${NodeID} does not exist`));
		}
	}

	return Promise.reject(new Error('Invalid Method'));
};
