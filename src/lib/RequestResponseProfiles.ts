import { ControllerCallbackObject, DeviceCallbackObject, MessageType } from '../types/Type_ZWaveJSRuntime';

export const getProfile = (Name: string, Result: unknown): ControllerCallbackObject | DeviceCallbackObject | undefined => {
	const Timestamp = new Date().getTime();

	if (Name === 'setNodeName') {
		const Event: ControllerCallbackObject = {
			Type: MessageType.EVENT,
			Event: { event: 'NODE_NAME_SET', timestamp: Timestamp, eventBody: Result }
		};
		return Event;
	}

	if (Name === 'setLocation') {
		const Event: ControllerCallbackObject = {
			Type: MessageType.EVENT,
			Event: { event: 'NODE_LOCATION_SET', timestamp: Timestamp, eventBody: Result }
		};
		return Event;
	}

	if (Name === 'ping') {
		const Event: ControllerCallbackObject = {
			Type: MessageType.EVENT,
			Event: { event: 'NODE_PING_RESULT', timestamp: Timestamp, eventBody: Result }
		};
		return Event;
	}

	if (Name === 'invokeCCAPI') {
		const Event: ControllerCallbackObject = {
			Type: MessageType.EVENT,
			Event: { event: 'CCAPI_OPERATION_COMPLETE', timestamp: Timestamp, eventBody: Result }
		};
		return Event;
	}

	if (Name === 'getValue') {
		const Event: ControllerCallbackObject = {
			Type: MessageType.EVENT,
			Event: { event: 'GET_VALUE_RESPONSE', timestamp: Timestamp, eventBody: Result }
		};
		return Event;
	}

	if (Name === 'pollValue') {
		const Event: ControllerCallbackObject = {
			Type: MessageType.EVENT,
			Event: { event: 'POLL_VALUE_RESPONSE', timestamp: Timestamp, eventBody: Result }
		};
		return Event;
	}

	if (Name === 'getValueDB') {
		const Event: ControllerCallbackObject = {
			Type: MessageType.EVENT,
			Event: { event: 'VALUE_DB', timestamp: Timestamp, eventBody: Result }
		};
		return Event;
	}

	if (Name === 'getNodes') {
		const Event: ControllerCallbackObject = {
			Type: MessageType.EVENT,
			Event: { event: 'NODE_LIST', timestamp: Timestamp, eventBody: Result }
		};
		return Event;
	}

	return undefined;
};
