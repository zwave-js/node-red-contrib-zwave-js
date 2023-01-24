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

			//TODO: Remote legacy format
			if (MSG.payload.mode) {
				self.warn(
					"You're using a deprecated message format, in a future release, this format will not be supported. Please consider updating your commands."
				);

				if (MSG.payload.mode === 'ControllerAPI' || MSG.payload.mode === 'DriverAPI') {
					self.runtime
						.controllerCommand(MSG.payload.method, MSG.payload.params)
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
				}

				if (MSG.payload.mode === 'CCAPI') {
					//
				}
				if (MSG.payload.mode === 'ValueAPI') {
					//
				}
			} else {
				const Parts = MSG.payload.cmd.split('.');
				const APICommand = {
					API: Parts[0] as API,
					Command: Parts[1]
				};

				if (APICommand.API === API.CONTROLLER) {
					self.runtime
						.controllerCommand(APICommand.Command, MSG.payload.argumnets)
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
				}

				if (APICommand.API === API.CC) {
					self.runtime
						.ccCommand(
							MSG.payload.commandClass,
							MSG.payload.method,
							MSG.payload.NodeId,
							MSG.payload.endpoint,
							MSG.payload.argumnets
						)
						.then((Result) => {
							done();
						})
						.catch((Error) => {
							done(Error);
						});
				}

				if (APICommand.API === API.VALUE) {
					self.runtime
						.valueCommand(
							APICommand.Command,
							MSG.payload.nodeId,
							MSG.payload.valueId,
							MSG.payload.value,
							MSG.payload.setValueOptions
						)
						.then((Result) => {
							done();
						})
						.catch((Error) => {
							done(Error);
						});
				}
			}
		});
	};
	RED.nodes.registerType('zwavejs-controller', init);
};
