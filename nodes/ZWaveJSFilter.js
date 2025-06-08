module.exports = (RED) => {
	const init = function (config) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;

		self.on('input', () => {
			// FILTER
		});

		self.on('close', (_, done) => {
			done();
		});
	};

	RED.nodes.registerType('zwavejs-filter', init);
};
