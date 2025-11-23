module.exports = (RED) => {
	const init = function (config) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;

		self.on('input', (msg, send, done) => {
			if (msg.payload?.event) {
				let VID;
				let Match;
				let PinIndex;
				switch (msg.payload?.event) {
					case 'VALUE_UPDATED':
					case 'VALUE_ADDED':
					case 'VALUE_NOTIFICATION':
						VID = msg.payload.eventBody.valueId;
						Match = self.config.splits.find(
							(V) =>
								V.commandClass === VID.commandClass &&
								V.property === VID.property &&
								(VID.propertyKey === undefined || V.propertyKey === VID.propertyKey)
						);
						break;

					case 'NOTIFICATION':
						VID = msg.payload.eventBody.ccId;
						break;
				}
				if (Match) {
					PinIndex = Match.index;
					msg.split = {
						name: Match.name
					};

					const out = new Array(self.config.splits.length);
					out[PinIndex] = msg;
					send(out);
					done();
				}
			}
		});

		self.on('close', (_, done) => {
			done();
		});
	};

	RED.nodes.registerType('zwavejs-splitter', init);
};
