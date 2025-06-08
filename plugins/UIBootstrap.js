const { CommandClasses, isApplicationCC } = require('@zwave-js/core');
const { Driver, getAPI } = require('zwave-js');

module.exports = function (RED) {
	const CCList = {};

	RED.httpAdmin.get(
		'/zwave-js/ui/global/getccmethods/:cc',
		RED.auth.needsPermission('flows.write'),
		(request, response) => {
			if (CCList[request.params.cc]) {
				response.json({ callSuccess: true, response: CCList[request.params.cc] });
			} else {
				response.json({ callSuccess: true, response: [] });
			}
		}
	);

	RED.httpAdmin.get('/zwave-js/ui/global/getcclist', RED.auth.needsPermission('flows.write'), (_, response) => {
		try {
			if (!Object.keys(CCList).length) {
				Object.keys(CommandClasses).forEach((CC) => {
					if (isApplicationCC(CommandClasses[CC])) {
						const API = getAPI(CommandClasses[CC]);
						if (API !== undefined) {
							const Methods = Object.getOwnPropertyNames(API.prototype).filter(
								(m) => m !== 'constructor' && m !== 'supportsCommand'
							);
							CCList[CC] = Methods;
						}
					}
				});
			}
			response.json({ callSuccess: true, response: Object.keys(CCList) });
		} catch (Err) {
			response.json({ callSuccess: false, response: Err });
		}
	});

	RED.httpAdmin.get('/zwave-js/ui/global/getports', RED.auth.needsPermission('flows.write'), (_, response) => {
		Driver.enumerateSerialPorts()
			.then((data) => {
				response.json({ callSuccess: true, response: data });
			})
			.catch((Error) => {
				response.json({ callSuccess: false, response: Error.message });
			});
	});
};
