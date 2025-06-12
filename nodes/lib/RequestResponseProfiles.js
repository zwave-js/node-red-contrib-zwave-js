const getProfile = (Name, Result, NodeID) => {
	const Timestamp = new Date().getTime();

	const makeEvent = (eventName) => {
		const event = {
			Type: 'EVENT',
			Event: {
				event: eventName,
				timestamp: Timestamp,
				eventBody: Result
			}
		};
		if (NodeID !== undefined) {
			event.Event.nodeId = NodeID;
		}
		return event;
	};

	if (Name === 'setName') return makeEvent('NODE_NAME_SET');
	if (Name === 'setLocation') return makeEvent('NODE_LOCATION_SET');
	if (Name === 'ping') return makeEvent('NODE_PING_RESPONSE');
	if (Name === 'invokeCCAPI') return makeEvent('CCAPI_OPERATION_RESPONSE');
	if (Name === 'getValue') return makeEvent('GET_VALUE_RESPONSE');
	if (Name === 'pollValue') return makeEvent('POLL_VALUE_RESPONSE');
	if (Name === 'getValueDB') return makeEvent('VALUE_DB');
	if (Name === 'getNodes') return makeEvent('NODE_LIST');
	if (Name === 'setValue') return makeEvent('SET_VALUE_RESPONSE');
	if (Name === 'refreshInfo') return makeEvent('REFRESH_INFO_RESPONSE');
	if (Name === 'proprietaryFunction') return makeEvent('PROPRIETARY_FUNCTION_RESULT');

	return undefined;
};

module.exports = { getProfile };
