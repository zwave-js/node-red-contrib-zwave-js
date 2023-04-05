import { NodeAPI } from 'node-red';
import { Driver, getAPI } from 'zwave-js';
import { CommandClasses } from '@zwave-js/core';
module.exports = (RED: NodeAPI) => {
	const CCList: { [CCName: string]: string[] } = {};

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
					const API = getAPI(CommandClasses[CC as keyof typeof CommandClasses]);
					if (API !== undefined) {
						const Methods = Object.getOwnPropertyNames(API.prototype).filter(
							(m) => m !== 'constructor' && m !== 'supportsCommand'
						);
						CCList[CC] = Methods;
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
