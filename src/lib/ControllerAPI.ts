import { getNodes, getValueDB } from '../lib/Fetchers';
import { AssociationAddress, Driver, ExclusionOptions, InclusionOptions, RFRegion } from 'zwave-js';

export const process = async (DriverInstance: Driver, Method: string, Args?: unknown[]): Promise<unknown> => {
	let Result: unknown;
	let Options: InclusionOptions | ExclusionOptions;

	if (Method === 'getAllAssociationGroups') {
		return new Promise((resolve, reject) => {
			try {
				const Formated: { [Endpoint: number]: unknown } = {};
				DriverInstance.controller.getAllAssociationGroups(Args?.[0] as number).forEach((M, I) => {
					Formated[I] = Object.fromEntries(M);
				});
				resolve(Formated);
			} catch (Error) {
				reject(Error);
			}
		});
	}

	if (Method === 'getAssociationGroups') {
		return new Promise((resolve, reject) => {
			try {
				Result = Object.fromEntries(DriverInstance.controller.getAssociationGroups(Args?.[0] as AssociationAddress));
				resolve(Result);
			} catch (Error) {
				reject(Error);
			}
		});
	}

	if (Method === 'getAllAssociations') {
		return new Promise((resolve, reject) => {
			try {
				const Formated: unknown[] = [];
				DriverInstance.controller.getAllAssociations(Args?.[0] as number).forEach((M, AD) => {
					Formated.push({
						associationAddress: AD,
						associations: Object.fromEntries(M)
					});
				});
				resolve(Formated);
			} catch (Error) {
				reject(Error);
			}
		});
	}

	if (Method === 'getAssociations') {
		return new Promise((resolve, reject) => {
			try {
				Result = Object.fromEntries(DriverInstance.controller.getAssociations(Args?.[0] as AssociationAddress));
				resolve(Result);
			} catch (Error) {
				reject(Error);
			}
		});
	}

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

	if (Method === 'setPowerlevel') {
		return new Promise((resolve, reject) => {
			DriverInstance.controller
				.setPowerlevel(Args?.[0] as number, Args?.[1] as number)
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

	if (Method === 'setRFRegion') {
		return new Promise((resolve, reject) => {
			DriverInstance.controller
				.setRFRegion(Args?.[0] as RFRegion)
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
