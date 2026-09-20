const Check = (msg) => {
	const API = msg?.payload?.cmd?.api;
	const Method = msg?.payload?.cmd?.method;
	const Props = msg?.payload?.cmdProperties;
	const NodeID = msg?.payload?.cmdProperties?.nodeId;
	const CCClass = msg?.payload?.cmdProperties?.commandClass;
	const CCCommand = msg?.payload?.cmdProperties?.method;
	const ValueID = msg?.payload?.cmdProperties?.valueId;
	const Value = msg?.payload?.cmdProperties?.value;
	const Args = msg?.payload?.cmdProperties?.args;

	/* Required */
	if (!API) return 'Missing payload.cmd.api';
	if (typeof API !== 'string') return 'Type payload.cmd.api must be string';
	if (!Method) return 'Missing payload.cmd.method';
	if (typeof Method !== 'string') return 'Type payload.cmd.method must be string';

	if (API === 'VALUE') {
		if (!Props) return 'Missing payload.cmdProperties';
		if (typeof Props !== 'object') return 'Type payload.cmdProperties must be object';

		if (!ValueID) return 'Missing payload.cmdProperties.valueId';
		if (typeof ValueID !== 'object') return 'Type payload.cmdProperties.valueId must be object';

		if (NodeID === undefined) return 'Missing payload.cmdProperties.nodeId';
		if (typeof NodeID !== 'number' && !Array.isArray(NodeID)) {
			return 'Type payload.cmdProperties.nodeId must be number or array of numbers';
		}

		if (Method === 'setValue' && Value === undefined) return 'Missing payload.cmdProperties.value';
	}

	if (API === 'CC') {
		if (!CCClass) return 'Missing payload.cmdProperties.commandClass';
		if (typeof CCClass !== 'number') return 'Type payload.cmdProperties.commandClass must be number';

		if (!CCCommand) return 'Missing payload.cmdProperties.method';
		if (typeof CCCommand !== 'string') return 'Type payload.cmdProperties.method must be string';

		if (typeof NodeID !== 'number') return 'Type payload.cmdProperties.nodeId must be number';
	}

	if (API === 'NODE') {
		if (Method === 'setName' && Value === undefined) return 'Missing payload.cmdProperties.value';
		if (Method === 'setLocation' && Value === undefined) return 'Missing payload.cmdProperties.value';
		if (typeof NodeID !== 'number') return 'Type payload.cmdProperties.nodeId must be number';
	}

	if (API === 'CONTROLLER') {
		if (Method === 'proprietaryFunction' && Args === undefined) return 'Missing payload.cmdProperties.args';
		if (Method === 'proprietaryFunction' && !Array.isArray(Args))
			return 'Type payload.cmdProperties.args must be array';
	}

	if (API === 'DRIVER') {
		if (Method === 'getValueDB' && Args !== undefined && !Array.isArray(Args))
			return 'Type payload.cmdProperties.args must be array of numbers';
	}

	return true;
};

module.exports = { Check };
