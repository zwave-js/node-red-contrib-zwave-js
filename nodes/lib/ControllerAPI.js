const { getNodes, getValueDB } = require('./Fetchers');
const { Message, MessagePriority, MessageType } = require('zwave-js');

const process = async function (DriverInstance, Method, Args) {
	if (Method === 'backupNVMRaw') {
		return DriverInstance.controller.backupNVMRaw(...Args);
	}
	if (Method === 'hardReset') {
		return DriverInstance.hardReset();
	}

	if (Method === 'beginJoiningNetwork') {
		return DriverInstance.controller.beginJoiningNetwork(...Args);
	}

	if (Method === 'beginLeavingNetwork') {
		return DriverInstance.controller.beginLeavingNetwork();
	}

	if (Method === 'stopJoiningNetwork') {
		return DriverInstance.controller.stopJoiningNetwork();
	}

	if (Method === 'stopLeavingNetwork') {
		return DriverInstance.controller.stopLeavingNetwork();
	}

	if (Method === 'getAllAssociationGroups') {
		try {
			const Formated = {};
			DriverInstance.controller.getAllAssociationGroups(...Args).forEach((M, I) => {
				Formated[I] = Object.fromEntries(M);
			});
			return Formated;
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'getAssociationGroups') {
		try {
			return Object.fromEntries(DriverInstance.controller.getAssociationGroups(...Args));
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'getAllAssociations') {
		try {
			const Formated = [];
			DriverInstance.controller.getAllAssociations(...Args).forEach((M, AD) => {
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

	if (Method === 'addAssociations') {
		try {
			return DriverInstance.controller.addAssociations(...Args);
		} catch (Err) {
			return Promise.reject(Err);
		}
	}
	if (Method === 'removeAssociations') {
		try {
			return DriverInstance.controller.removeAssociations(...Args);
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'getAssociations') {
		try {
			return Object.fromEntries(DriverInstance.controller.getAssociations(...Args));
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'getPowerlevel') {
		return DriverInstance.controller.getPowerlevel();
	}

	if (Method === 'setPowerlevel') {
		return DriverInstance.controller.setPowerlevel(...Args);
	}

	if (Method === 'getRFRegion') {
		return DriverInstance.controller.getRFRegion();
	}

	if (Method === 'setRFRegion') {
		return DriverInstance.controller.setRFRegion(...Args);
	}

	if (Method === 'beginInclusion') {
		return DriverInstance.controller.beginInclusion(...Args);
	}

	if (Method === 'stopInclusion') {
		return DriverInstance.controller.stopInclusion();
	}

	if (Method === 'beginExclusion') {
		return DriverInstance.controller.beginExclusion();
	}

	if (Method === 'stopExclusion') {
		return DriverInstance.controller.stopExclusion();
	}

	if (Method === 'getValueDB') {
		try {
			return getValueDB(DriverInstance, Args);
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
			return DriverInstance.controller.provisionSmartStartNode(...Args);
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'unprovisionSmartStartNode') {
		try {
			return DriverInstance.controller.unprovisionSmartStartNode(...Args);
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	if (Method === 'proprietaryFunction') {
		const ZWaveMessage = new Message(DriverInstance, {
			type: MessageType.Request,
			functionType: Args[0],
			payload: Args[1]
		});

		const MessageSettings = {
			priority: MessagePriority.Controller,
			supportCheck: false
		};

		return DriverInstance.sendMessage(ZWaveMessage, MessageSettings);
	}

	return Promise.reject(new Error('Invalid Method'));
};

module.exports = { process };
