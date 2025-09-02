const getProfile = (Name, Result, NodeID, ID) => {
	const Timestamp = new Date().getTime();

	const makeEvent = (eventName, api) => {
		const event = {
			Type: 'RESPONSE',
			Event: {
				id: ID,
				event: 'API_RESPONSE',
				requestedAPI: api,
				requestedMethod: Name,
				eventSubject: eventName,
				timestamp: Timestamp,
				eventBody: Result
			}
		};
		if (NodeID !== undefined) {
			event.Event.nodeId = NodeID;
		}

		if (eventName === 'SET_VALUE_RESPONSE') {
			switch (Result.status) {
				case 0:
					event.Event.eventBody.status = 'NO_SUPPORT';
					break;
				case 1:
					event.Event.eventBody.status = 'OK_PENDING_CHANGE';
					break;
				case 2:
					event.Event.eventBody.status = 'REJECTED';
					break;
				case 3:
					event.Event.eventBody.status = 'ENDPOINT_NOT_FOUND';
					break;
				case 4:
					event.Event.eventBody.status = 'SET_NOT_IMPLEMENTED';
					break;
				case 5:
					event.Event.eventBody.status = 'INVALID_VALUE';
					break;
				default:
					event.Event.eventBody.status = 'OK';
			}
		}

		return event;
	};

	if (Name === 'setName') return makeEvent('NODE_NAME_SET', 'NODE');
	if (Name === 'setLocation') return makeEvent('NODE_LOCATION_SET', 'NODE');
	if (Name === 'ping') return makeEvent('NODE_PING_RESPONSE', 'NODE');
	if (Name === 'invokeCCAPI') return makeEvent('CCAPI_OPERATION_RESPONSE', 'CC');
	if (Name === 'getValue') return makeEvent('GET_VALUE_RESPONSE', 'VALUE');
	if (Name === 'pollValue') return makeEvent('POLL_VALUE_RESPONSE', 'VALUE');
	if (Name === 'getValueDB') return makeEvent('VALUE_DB', 'DRIVER');
	if (Name === 'getNodes') return makeEvent('NODE_LIST', 'CONTROLLER');
	if (Name === 'setValue') return makeEvent('SET_VALUE_RESPONSE', 'VALUE');
	if (Name === 'refreshInfo') return makeEvent('REFRESH_INFO_RESPONSE', 'NODE');
	if (Name === 'proprietaryFunction') return makeEvent('PROPRIETARY_FUNCTION_RESULT', 'CONTROLLER');

	return undefined;
};

module.exports = { getProfile };
