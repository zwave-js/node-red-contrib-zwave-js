import { NodeAPI } from 'node-red';
import { UserPayloadPackage, Type_ZWaveJSRuntime, MessageType } from '../types/Type_ZWaveJSRuntime';
import { Type_ZWaveJSDevice, Type_ZWaveJSDeviceConfig } from '../types/Type_ZWaveJSDevice';

module.exports = (RED: NodeAPI) => {
	const init = function (this: Type_ZWaveJSDevice, config: Type_ZWaveJSDeviceConfig) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;
		self.runtime = RED.nodes.getNode(self.config.runtimeId) as Type_ZWaveJSRuntime;

		const callback = (Data: UserPayloadPackage) => {
			switch (Data.Type) {
				case MessageType.STATUS:
					self.status(Data.Status);
					if (Data.Status.clearTime) {
						setTimeout(() => {
							self.status({});
						}, Data.Status.clearTime);
					}
					break;

				case MessageType.EVENT:
					self.send({ payload: Data.Event });
					break;
			}
		};

		self.runtime.registerDeviceNode(self.id, undefined, callback);

		self.on('close', (_: boolean, done: () => void) => {
			self.runtime.deregisterDeviceNode(self.id);
			done();
		});
	};

	RED.nodes.registerType('zwavejs-device', init);
};
