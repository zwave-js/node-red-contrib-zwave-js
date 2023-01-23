import { NodeAPI } from 'node-red';
import { ControllerCallbackObject, Type_ZWaveJSRuntime, MessageType, API } from '../types/Type_ZWaveJSRuntime';
import { Type_ZWaveJSControllerConfig } from '../types/Type_ZWaveJSControllerConfig';
import { Type_ZWaveJSController } from '../types/Type_ZWaveJSController';

module.exports = (RED: NodeAPI) => {
	const init = function (this: Type_ZWaveJSController, config: Type_ZWaveJSControllerConfig) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;
		self.runtime = RED.nodes.getNode(self.config.runtimeId) as Type_ZWaveJSRuntime;

		const callback = (Data: ControllerCallbackObject) => {
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
		self.runtime.registerControllerNode(self.id, callback);

		self.on('close', (_: boolean, done: () => void) => {
			self.runtime.deregisterControllerNode(self.id);
			done();
		});

		self.on('input', (msg, send, done) => {
			const MSG = msg as Record<string, any>;
			const TypedAPIString: keyof typeof API = MSG.topic;
			const TargetAPI = API[TypedAPIString];

			switch (TargetAPI) {
				case API.VALUE:
					self.runtime
						.valueCommand(MSG.cmd, MSG.nodeId, MSG.valueId, MSG.payload, MSG.options)
						.then((Result) => {
							done();
						})
						.catch((Error) => {
							done(Error);
						});
					break;
				case API.CONTROLLER:
					self.runtime
						.controllerCommand(MSG.cmd, MSG.payload)
						.then((Result) => {
							if (Result.Type !== undefined) {
								switch (Result.Type) {
									case MessageType.EVENT:
										send({ payload: Result.Event });
										done();
										break;
								}
							} else {
								done();
							}
						})
						.catch((Error) => {
							done(Error);
						});
					break;
			}
		});
	};
	RED.nodes.registerType('zwavejs-controller', init);
};
