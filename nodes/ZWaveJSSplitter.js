module.exports = (RED) => {
	const init = function (config) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;

		self.on('input', (msg, send, done) => {
			if (msg.payload?.event) {
				let VID;

				switch (msg.payload?.event) {
					case 'VALUE_UPDATED':
					case 'VALUE_ADDED':
						VID = msg.payload.eventBody.valueId;
						break;

					case 'NOTIFICATION':
						VID = msg.payload.eventBody.ccId;
						break;

					case 'VALUE_NOTIFICATION':
						VID = msg.payload.eventBody.valueId;
						break;
				}
			} else {
				send(msg);
				done();
			}
		});

		self.on('close', (_, done) => {
			done();
		});
	};

	RED.nodes.registerType('zwavejs-splitter', init);
};
