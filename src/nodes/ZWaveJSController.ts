import { NodeAPI } from 'node-red';
import { UserPayloadPackage, Type_ZWaveJSRuntime, MessageType, API } from '../types/Type_ZWaveJSRuntime';
import { Type_ZWaveJSControllerConfig } from '../types/Type_ZWaveJSControllerConfig';
import { InputMessage, Type_ZWaveJSController } from '../types/Type_ZWaveJSController';
import { getProfile } from '../lib/RequestResponseProfiles';

module.exports = (RED: NodeAPI) => {
	const init = function (this: Type_ZWaveJSController, config: Type_ZWaveJSControllerConfig) {
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
					const APIKey = Req.cmd.api as keyof typeof API;
					const TargetAPI = API[APIKey];
					const APIMethod = Req.cmd.method;

					if (TargetAPI === API.CONTROLLER) {
						self.runtime
							.controllerCommand(APIMethod, Req.cmdProperties.args)
							.then((Result) => {
								const Return = getProfile(APIMethod, Result, Req.cmdProperties.nodeId) as UserPayloadPackage;
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

					if (
						TargetAPI === API.CC &&
						Req.cmdProperties.commandClass &&
						Req.cmdProperties.method &&
						Req.cmdProperties.nodeId
					) {
						self.runtime
							.ccCommand(
								APIMethod,
								Req.cmdProperties.commandClass,
								Req.cmdProperties.method,
								Req.cmdProperties.nodeId,
								Req.cmdProperties.endpoint,
								Req.cmdProperties.args
							)
							.then((Result) => {
								const Return = getProfile(APIMethod, Result, Req.cmdProperties.nodeId) as UserPayloadPackage;
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

					if (TargetAPI === API.VALUE && Req.cmdProperties.valueId && Req.cmdProperties.nodeId) {
						self.runtime
							.valueCommand(
								APIMethod,
								Req.cmdProperties.nodeId,
								Req.cmdProperties.valueId,
								Req.cmdProperties.value,
								Req.cmdProperties.setValueOptions
							)
							.then((Result) => {
								const Return = getProfile(APIMethod, Result, Req.cmdProperties.nodeId) as UserPayloadPackage;
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
