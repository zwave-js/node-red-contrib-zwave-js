import { NodeAPI } from 'node-red';
import { Type_ZWaveJSFilter, Type_ZWaveJSFilterConfig } from '../types/Type_ZWaveJSFilter';

module.exports = (RED: NodeAPI) => {
	const init = function (this: Type_ZWaveJSFilter, config: Type_ZWaveJSFilterConfig) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;

		self.on('input', () => {
			// FILTER
		});

		self.on('close', (_: boolean, done: () => void) => {
			done();
		});
	};

	RED.nodes.registerType('zwavejs-filter', init);
};
