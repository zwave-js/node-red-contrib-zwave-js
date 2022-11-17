import { getNodes, getValueDB } from '../lib/Fetchers';
import { Driver, InclusionOptions } from 'zwave-js';
import { MessageType } from '../types/Type_ZWaveJSRuntime';
import { ControllerCallbackObject } from '../types/Type_ZWaveJSRuntime';

export const process = async (
	DriverInstance: Driver,
	Method: string,
	Params?: any[]
): Promise<ControllerCallbackObject | boolean | undefined> => {
	let Result: any;
	let Timestamp: number;
	let Event: ControllerCallbackObject;
	let Options: InclusionOptions;
	switch (Method) {
		case 'beginInclusion':
			return new Promise((resolve) => {
				Options = Params?.[0];
				DriverInstance.controller.beginInclusion(Options).then((result) => {
					resolve(result);
				});
			});

		case 'stopInclusion':
			return new Promise((resolve) => {
				DriverInstance.controller.stopInclusion().then((result) => {
					resolve(result);
				});
			});

		case 'getValueDB':
			return new Promise((resolve) => {
				Timestamp = new Date().getTime();
				Result = getValueDB(DriverInstance, Params as number[]);
				Event = {
					Type: MessageType.EVENT,
					Event: { event: 'VALUE_DB', timestamp: Timestamp, eventBody: Result }
				};
				resolve(Event);
			});

		case 'getNodes':
			return new Promise((resolve) => {
				Timestamp = new Date().getTime();
				Result = getNodes(DriverInstance);
				Event = {
					Type: MessageType.EVENT,
					Event: { event: 'NODE_LIST', timestamp: Timestamp, eventBody: Result }
				};
				resolve(Event);
			});

		default:
			return undefined;
	}
};
