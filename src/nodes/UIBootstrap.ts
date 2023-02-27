import { NodeAPI } from 'node-red';
import { Driver } from 'zwave-js';
module.exports = (RED: NodeAPI) => {
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
