import { getNodes, getValueDB } from '../lib/Fetchers';
import {
	AssociationAddress,
	Driver,
	ExclusionOptions,
	InclusionOptions,
	Message,
	MessagePriority,
	MessageType,
	PlannedProvisioningEntry,
	RFRegion
} from 'zwave-js';

export const process = async (DriverInstance: Driver, Method: string, Args?: unknown[]): Promise<unknown> => {
	if (Method === 'getAllAssociationGroups') {
		try {
			const Formated: { [Endpoint: number]: unknown } = {};
			DriverInstance.controller.getAllAssociationGroups(Args?.[0] as number).forEach((M, I) => {
				Formated[I] = Object.fromEntries(M);
			});
			return Formated;
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'getAssociationGroups') {
		try {
			return Object.fromEntries(DriverInstance.controller.getAssociationGroups(Args?.[0] as AssociationAddress));
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'getAllAssociations') {
		try {
			const Formated: unknown[] = [];
			DriverInstance.controller.getAllAssociations(Args?.[0] as number).forEach((M, AD) => {
				Formated.push({
					associationAddress: AD,
					associations: Object.fromEntries(M)
				});
			});
			return Formated;
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'getAssociations') {
		try {
			return Object.fromEntries(DriverInstance.controller.getAssociations(Args?.[0] as AssociationAddress));
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'getPowerlevel') {
		return DriverInstance.controller.getPowerlevel();
	}

	if (Method === 'setPowerlevel') {
		return DriverInstance.controller.setPowerlevel(Args?.[0] as number, Args?.[1] as number);
	}

	if (Method === 'getRFRegion') {
		return DriverInstance.controller.getRFRegion();
	}

	if (Method === 'setRFRegion') {
		return DriverInstance.controller.setRFRegion(Args?.[0] as RFRegion);
	}

	if (Method === 'beginInclusion') {
		return DriverInstance.controller.beginInclusion(Args?.[0] as InclusionOptions);
	}

	if (Method === 'stopInclusion') {
		return DriverInstance.controller.stopInclusion();
	}

	if (Method === 'beginExclusion') {
		return DriverInstance.controller.beginExclusion(Args?.[0] as ExclusionOptions);
	}

	if (Method === 'stopExclusion') {
		return DriverInstance.controller.stopExclusion();
	}

	if (Method === 'getValueDB') {
		try {
			return getValueDB(DriverInstance, Args as number[]);
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'getNodes') {
		try {
			return getNodes(DriverInstance);
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'provisionSmartStartNode') {
		try {
			return DriverInstance.controller.provisionSmartStartNode(Args?.[0] as PlannedProvisioningEntry)
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'unprovisionSmartStartNode') {
		try {
			return DriverInstance.controller.unprovisionSmartStartNode(Args?.[0] as string)
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'proprietaryFunction') {
		const ZWaveMessage = new Message(DriverInstance, {
			type: MessageType.Request,
			functionType: Args?.[0] as number,
			payload: Args?.[1] as Buffer
		});

		const MessageSettings = {
			priority: MessagePriority.Controller,
			supportCheck: false
		};

		return DriverInstance.sendMessage(ZWaveMessage, MessageSettings);
	}

	return Promise.reject(new Error('Invalid Method'));
};
