import { NodeAPI } from 'node-red';
import { Type_ZWaveJSFactory, Type_ZWaveJSFactoryConfig } from '../types/Type_ZWaveJSFactory';

module.exports = (RED: NodeAPI) => {
	const init = function (this: Type_ZWaveJSFactory, config: Type_ZWaveJSFactoryConfig) {
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

	RED.nodes.registerType('zwavejs-factory', init);
};
