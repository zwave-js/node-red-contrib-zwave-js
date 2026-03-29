const { getNodes } = require('./Fetchers');
const { Message, MessagePriority, MessageType } = require('zwave-js');
const { invokeMethod } = require('./Invoker');

const process = async function (DriverInstance, Method, Args) {
	if (Method === 'getNodes') {
		return getNodes(DriverInstance);
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
		return Object.fromEntries(
			[...DriverInstance.controller.getAllAssociationGroups(...Args)].map(([k, v]) => [k, Object.fromEntries(v)])
		);
	}

	if (Method === 'getAssociationGroups') {
		return Object.fromEntries(DriverInstance.controller.getAssociationGroups(...Args));
	}

	if (Method === 'getAssociations') {
		return Object.fromEntries(DriverInstance.controller.getAssociations(...Args));
	}

	if (Method === 'getAllAssociations') {
		return Array.from(DriverInstance.controller.getAllAssociations(...Args), ([associationAddress, associations]) => ({
			associationAddress,
			associations: Object.fromEntries(associations)
		}));
	}

	if (Method === 'getAllAvailableFirmwareUpdates') {
		let updatesMap;
		if (Args !== undefined) {
			updatesMap = await DriverInstance.controller.getAllAvailableFirmwareUpdates(...Args);
		} else {
			updatesMap = await DriverInstance.controller.getAllAvailableFirmwareUpdates();
		}

		return Object.fromEntries(updatesMap);
	}

	if (Method === 'beginRebuildingRoutes' || Method === 'rebuildNodeRoutes') {
		if (DriverInstance.controller.isRebuildingRoutes) {
			throw new Error('The controller is already rebuilding one or more routes.');
		}
	}

	/* Dynamic */
	return invokeMethod(DriverInstance.controller, Method, Args || []);
};

module.exports = { process };
