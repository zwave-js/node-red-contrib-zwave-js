import { getNodes, getValueDB } from '../lib/Fetchers';
import { Driver, ExclusionOptions, InclusionOptions } from 'zwave-js';

export const process = async (DriverInstance: Driver, Method: string, Params?: any[]): Promise<any> => {
	let Result: any;
	let Options: InclusionOptions | ExclusionOptions;
	switch (Method) {
		case 'getPowerlevel':
			return new Promise((resolve, reject) => {
				DriverInstance.controller
					.getPowerlevel()
					.then((result) => {
						resolve(result);
					})
					.catch((error) => {
						reject(error);
					});
			});

		case 'getRFRegion':
			return new Promise((resolve, reject) => {
				DriverInstance.controller
					.getRFRegion()
					.then((result) => {
						resolve(result);
					})
					.catch((error) => {
						reject(error);
					});
			});

		case 'beginInclusion':
			return new Promise((resolve, reject) => {
				Options = Params?.[0];
				DriverInstance.controller
					.beginInclusion(Options as InclusionOptions)
					.then((result) => {
						resolve(result);
					})
					.catch((error) => {
						reject(error);
					});
			});

		case 'beginExclusion':
			return new Promise((resolve, reject) => {
				Options = Params?.[0];
				DriverInstance.controller
					.beginExclusion(Options as ExclusionOptions)
					.then((result) => {
						resolve(result);
					})
					.catch((error) => {
						reject(error);
					});
			});

		case 'stopInclusion':
			return new Promise((resolve, reject) => {
				DriverInstance.controller
					.stopInclusion()
					.then((result) => {
						resolve(result);
					})
					.catch((error) => {
						reject(error);
					});
			});

		case 'getValueDB':
			return new Promise((resolve, reject) => {
				try {
					Result = getValueDB(DriverInstance, Params as number[]);
					resolve(Result);
				} catch (Err) {
					reject(Err);
				}
			});

		case 'getNodes':
			return new Promise((resolve, reject) => {
				try {
					Result = getNodes(DriverInstance);
					resolve(Result);
				} catch (Err) {
					reject(Err);
				}
			});

		default:
			return undefined;
	}
};
