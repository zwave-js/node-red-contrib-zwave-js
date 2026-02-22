const { getNodes } = require('./Fetchers');
const { Message, MessagePriority, MessageType } = require('zwave-js');
const { invokeMethod } = require('./Invoker');

const process = async function (DriverInstance, Method, Args) {
	if (Method === 'getNodes') {
		try {
			return getNodes(DriverInstance);
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

	if (Method === 'getAssociations') {
		try {
			return Object.fromEntries(DriverInstance.controller.getAssociations(...Args));
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

	if (Method === 'beginRebuildingRoutes' || Method === 'rebuildNodeRoutes') {
		if (DriverInstance.controller.isRebuildingRoutes) {
			return Promise.reject(new Error('The controller is already rebuilding one or more routes.'));
		}
	}

	/* Dynamic */
	return invokeMethod(DriverInstance.controller, Method, Args)


};

module.exports = { process };
