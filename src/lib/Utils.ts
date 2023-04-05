export const LegacyNode = (msg: Record<string, any>): true | undefined => {
	const CCAPIs = ['CCAPI'];
	const ValueAPIs = ['ValueAPI'];

	if (msg.payload.mode) {
		if (ValueAPIs.includes(msg.payload.mode)) {
			const New: Record<string, any> = {
				cmd: {
					api: 'VALUE',
					method: msg.payload.method
				},
				cmdProperties: {
					nodeId: msg.payload.node,
					valueId: msg.payload.params[0]
				}
			};

			if (msg.payload.params[1]) {
				New.cmdProperties.value = msg.payload.params[1];
			}
			if (msg.payload.params[2]) {
				New.cmdProperties.setValueOptions = msg.payload.params[2];
			}

			msg.payload = New;
			return true;
		}

		if (CCAPIs.includes(msg.payload.mode)) {
			const New: Record<string, any> = {
				cmd: {
					api: 'CC',
					method: 'invokeCCAPI'
				},
				cmdProperties: {
					nodeId: msg.payload.node,
					commandClass: msg.payload.cc,
					method: msg.payload.method
				}
			};

			if (msg.payload.params) {
				New.cmdProperties.args = msg.payload.params;
			}

			if (msg.payload.endpoint) {
				New.cmdProperties.endpoint = msg.payload.endpoint;
			}

			msg.payload = New;
			return true;
		}
	}

	return undefined;
};

export const LegacyController = (msg: Record<string, any>): true | undefined => {
	const ControllerAPIs = ['ControllerAPI', 'DriverAPI'];
	const CCAPIs = ['CCAPI'];
	const ValueAPIs = ['ValueAPI'];

	if (msg.payload.mode) {
		if (ControllerAPIs.includes(msg.payload.mode)) {
			const New: Record<string, any> = {
				cmd: {
					api: 'CONTROLLER',
					method: msg.payload.method
				},
				cmdProperties: {
					args: msg.payload.params
				}
			};

			msg.payload = New;
			return true;
		}

		if (ValueAPIs.includes(msg.payload.mode)) {
			const New: Record<string, any> = {
				cmd: {
					api: 'VALUE',
					method: msg.payload.method
				},
				cmdProperties: {
					nodeId: msg.payload.node,
					valueId: msg.payload.params[0]
				}
			};

			if (msg.payload.params[1]) {
				New.cmdProperties.value = msg.payload.params[1];
			}
			if (msg.payload.params[2]) {
				New.cmdProperties.setValueOptions = msg.payload.params[2];
			}

			msg.payload = New;
			return true;
		}

		if (CCAPIs.includes(msg.payload.mode)) {
			const New: Record<string, any> = {
				cmd: {
					api: 'CC',
					method: 'invokeCCAPI'
				},
				cmdProperties: {
					nodeId: msg.payload.node,
					commandClass: msg.payload.cc,
					method: msg.payload.method
				}
			};

			if (msg.payload.params) {
				New.cmdProperties.args = msg.payload.params;
			}

			if (msg.payload.endpoint) {
				New.cmdProperties.endpoint = msg.payload.endpoint;
			}

			msg.payload = New;
			return true;
		}
	}

	return undefined;
};
