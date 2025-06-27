const getProfile = (Name, Result, NodeID) => {
	const Timestamp = new Date().getTime();

	const makeEvent = (eventName, api) => {
		const event = {
			Type: 'RESPONSE',
			Event: {
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
