import { UserPayloadPackage, MessageType } from '../types/Type_ZWaveJSRuntime';

export const getProfile = (Name: string, Result: unknown, NodeID?: number): UserPayloadPackage | undefined => {
	const Timestamp = new Date().getTime();

	if (Name === 'setNodeName') {
		const Event: UserPayloadPackage = {
			Type: MessageType.EVENT,
			Event: { event: 'NODE_NAME_SET', timestamp: Timestamp, eventBody: Result }
		};
		if (NodeID) {
			Event.Event.nodeId = NodeID;
		}
		return Event;
	}

	if (Name === 'setLocation') {
		const Event: UserPayloadPackage = {
			Type: MessageType.EVENT,
			Event: { event: 'NODE_LOCATION_SET', timestamp: Timestamp, eventBody: Result }
		};
		if (NodeID) {
			Event.Event.nodeId = NodeID;
		}
		return Event;
	}

	if (Name === 'ping') {
		const Event: UserPayloadPackage = {
			Type: MessageType.EVENT,
			Event: { event: 'NODE_PING_RESPONSE', timestamp: Timestamp, eventBody: Result }
		};
		if (NodeID) {
			Event.Event.nodeId = NodeID;
		}
		return Event;
	}

	if (Name === 'invokeCCAPI') {
		const Event: UserPayloadPackage = {
			Type: MessageType.EVENT,
			Event: { event: 'CCAPI_OPERATION_RESPONSE', timestamp: Timestamp, eventBody: Result }
		};
		if (NodeID) {
			Event.Event.nodeId = NodeID;
		}
		return Event;
	}

	if (Name === 'getValue') {
		const Event: UserPayloadPackage = {
			Type: MessageType.EVENT,
			Event: { event: 'GET_VALUE_RESPONSE', timestamp: Timestamp, eventBody: Result }
		};
		if (NodeID) {
			Event.Event.nodeId = NodeID;
		}
		return Event;
	}

	if (Name === 'pollValue') {
		const Event: UserPayloadPackage = {
			Type: MessageType.EVENT,
			Event: { event: 'POLL_VALUE_RESPONSE', timestamp: Timestamp, eventBody: Result }
		};
		if (NodeID) {
			Event.Event.nodeId = NodeID;
		}
		return Event;
	}

	if (Name === 'getValueDB') {
		const Event: UserPayloadPackage = {
			Type: MessageType.EVENT,
			Event: { event: 'VALUE_DB', timestamp: Timestamp, eventBody: Result }
		};
		if (NodeID) {
			Event.Event.nodeId = NodeID;
		}
		return Event;
	}

	if (Name === 'getNodes') {
		const Event: UserPayloadPackage = {
			Type: MessageType.EVENT,
			Event: { event: 'NODE_LIST', timestamp: Timestamp, eventBody: Result }
		};
		if (NodeID) {
			Event.Event.nodeId = NodeID;
		}
		return Event;
	}

	return undefined;
};
