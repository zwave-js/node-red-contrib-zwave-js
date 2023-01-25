import { NodeAPI } from 'node-red';
import { ControllerCallbackObject, Type_ZWaveJSRuntime, MessageType, API } from '../types/Type_ZWaveJSRuntime';
import { Type_ZWaveJSControllerConfig } from '../types/Type_ZWaveJSControllerConfig';
import { InputMessage, Type_ZWaveJSController } from '../types/Type_ZWaveJSController';
import { getProfile } from '../lib/RequestResponseProfiles';

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

		//TODO: Remote legacy format
		const Legacy = (msg: any, send: any, done: any) => {
			self.warn(
				"You're using a deprecated message format, in a future release, this format will not be supported. Please consider updating your commands."
			);

			const payload = msg.payload as Record<string, any>;
			send({ payload: payload });
			done();
		};

		self.on('input', (msg, send, done) => {
			//TODO: Remote legacy format
			if ((msg.payload as any).mode) {
				Legacy(msg, send, done);
			} else {
				const Req = msg.payload as InputMessage;
				if (Req.cmd) {
					const Parts = Req.cmd.split('.');
					const APIKey = Parts[0] as keyof typeof API;
					const APICommand = {
						API: API[APIKey],
						Command: Parts[1]
					};

					if (APICommand.API === API.CONTROLLER) {
						self.runtime
							.controllerCommand(APICommand.Command, Req.args)
							.then((Result) => {
								const Return = getProfile(APICommand.Command, Result) as ControllerCallbackObject;
								if (Return.Type !== undefined && Return.Type === MessageType.EVENT) {
									send({ payload: Return.Event });
									done();
								} else {
									done();
								}
							})
							.catch((Error) => {
								done(Error);
							});
					}

					if (APICommand.API === API.CC && Req.commandClass && Req.commandClassMethod && Req.nodeId) {
						self.runtime
							.ccCommand(
								APICommand.Command,
								Req.commandClass,
								Req.commandClassMethod,
								Req.nodeId,
								Req.endpoint,
								Req.args
							)
							.then((Result) => {
								const Return = getProfile(APICommand.Command, Result) as ControllerCallbackObject;
								if (Return.Type !== undefined && Return.Type === MessageType.EVENT) {
									send({ payload: Return.Event });
									done();
								} else {
									done();
								}
							})
							.catch((Error) => {
								done(Error);
							});
					}

					if (APICommand.API === API.VALUE && Req.valueId && Req.nodeId) {
						self.runtime
							.valueCommand(APICommand.Command, Req.nodeId, Req.valueId, Req.value, Req.setValueOptions)
							.then((Result) => {
								const Return = getProfile(APICommand.Command, Result) as ControllerCallbackObject;
								if (Return.Type !== undefined && Return.Type === MessageType.EVENT) {
									send({ payload: Return.Event });
									done();
								} else {
									done();
								}
							})
							.catch((Error) => {
								done(Error);
							});
					}
				} else {
					done(new Error('msg.payload is not a valid command.'));
				}
			}
		});
	};
	RED.nodes.registerType('zwavejs-controller', init);
};
