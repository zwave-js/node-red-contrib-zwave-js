import { getNodes, getValueDB } from '../lib/Fetchers';
import { Driver, ExclusionOptions, InclusionOptions } from 'zwave-js';

export const process = async (DriverInstance: Driver, Method: string, Args?: unknown[]): Promise<unknown> => {
	let Result: unknown;
	let Options: InclusionOptions | ExclusionOptions;

	if (Method === 'getPowerlevel') {
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
	}

	if (Method === 'getRFRegion') {
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
	}

	if (Method === 'beginInclusion') {
		return new Promise((resolve, reject) => {
			Options = Args?.[0] as InclusionOptions;
			DriverInstance.controller
				.beginInclusion(Options as InclusionOptions)
				.then((result) => {
					resolve(result);
				})
				.catch((error) => {
					reject(error);
				});
		});
	}

	if (Method === 'beginExclusion') {
		return new Promise((resolve, reject) => {
			Options = Args?.[0] as ExclusionOptions;
			DriverInstance.controller
				.beginExclusion(Options as ExclusionOptions)
				.then((result) => {
					resolve(result);
				})
				.catch((error) => {
					reject(error);
				});
		});
	}

	if (Method === 'stopInclusion') {
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
	}

	if (Method === 'stopExclusion') {
		return new Promise((resolve, reject) => {
			DriverInstance.controller
				.stopExclusion()
				.then((result) => {
					resolve(result);
				})
				.catch((error) => {
					reject(error);
				});
		});
	}

	if (Method === 'getValueDB') {
		return new Promise((resolve, reject) => {
			try {
				Result = getValueDB(DriverInstance, Args as number[]);
				resolve(Result);
			} catch (Err) {
				reject(Err);
			}
		});
	}

	if (Method === 'getNodes') {
		return new Promise((resolve, reject) => {
			try {
				Result = getNodes(DriverInstance);
				resolve(Result);
			} catch (Err) {
				reject(Err);
			}
		});
	}

	return Promise.reject(new Error('Invalid Method'));
};
