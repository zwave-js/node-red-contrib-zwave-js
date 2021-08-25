'use strict';
module.exports = function (RED) {
	function Init(config) {
		RED.nodes.createNode(this, config);
		const node = this;


		node.on('input', Input);

		async function Input(msg, send, done) {
			send(msg);
			if (done) {
				done();
			}
		}

		node.on('close', (done) => {
			if (done) {
				done();
			}
		});
	}
	RED.nodes.registerType('event-filter', Init);
};
