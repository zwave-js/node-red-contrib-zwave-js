import { NodeAPI } from 'node-red';
import { UserPayloadPackage, Type_ZWaveJSRuntime, MessageType } from '../types/Type_ZWaveJSRuntime';
import { Type_ZWaveJSControllerConfig } from '../types/Type_ZWaveJSController';
import { InputMessage, Type_ZWaveJSController } from '../types/Type_ZWaveJSController';
import { getProfile } from '../lib/RequestResponseProfiles';
import { LegacyController } from '../lib/Utils';

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

		const sendTrackingUpdate = (Req: InputMessage, Response: unknown) => {
			if (Req.cmd.trackingToken !== undefined) {
				const Timestamp = new Date().getTime();
				const TrackingResponse = {
					event: 'TRACKING_TOKEN_RETURN',
					timestamp: Timestamp,
					eventBody: { token: Req.cmd.trackingToken, response: Response }
				};
				self.send({ payload: TrackingResponse });
			}
		};

		self.on('input', (msg, send, done) => {
			// TODO: Remove me
			if (LegacyController(msg)) {
				self.warn(
					'You are using a deprecated Message API  - Please update your commands. A future version will remove support for the old format.'
				);
			}

			const Req = msg.payload as InputMessage;

			if (Req.cmd) {
				switch (Req.cmd.api) {
					// Controller API
					case 'CONTROLLER':
						self.runtime
							.controllerCommand(Req.cmd.method, Req.cmdProperties?.args)
							.then((Result) => {
								sendTrackingUpdate(Req, Result);
								const Return = getProfile(Req.cmd.method, Result, Req.cmdProperties?.nodeId) as UserPayloadPackage;
								if (Return && Return.Type === MessageType.EVENT) {
									send({ payload: Return.Event });
									done();
								} else {
									done();
								}
							})
							.catch((Error) => {
								sendTrackingUpdate(Req, Error);
								done(Error);
							});
						break;

					// Command Class API
					case 'CC':
						if (Req.cmdProperties?.commandClass && Req.cmdProperties?.method && Req.cmdProperties?.nodeId) {
							self.runtime
								.ccCommand(
									Req.cmd.method,
									Req.cmdProperties?.commandClass,
									Req.cmdProperties?.method,
									Req.cmdProperties?.nodeId,
									Req.cmdProperties?.endpoint,
									Req.cmdProperties?.args
								)
								.then((Result) => {
									sendTrackingUpdate(Req, Result);
									const Return = getProfile(Req.cmd.method, Result, Req.cmdProperties?.nodeId) as UserPayloadPackage;
									if (Return && Return.Type === MessageType.EVENT) {
										send({ payload: Return.Event });
										done();
									} else {
										done();
									}
								})
								.catch((Error) => {
									sendTrackingUpdate(Req, Error);
									done(Error);
								});
						} else {
							done(new Error('cmdProperties is either missing or has fewer requied properties.'));
						}
						break;

					// Value API
					case 'VALUE':
						if (Req.cmdProperties?.nodeId && Req.cmdProperties?.valueId) {
							self.runtime
								.valueCommand(
									Req.cmd.method,
									Req.cmdProperties.nodeId,
									Req.cmdProperties.valueId,
									Req.cmdProperties.value,
									Req.cmdProperties.setValueOptions
								)
								.then((Result) => {
									sendTrackingUpdate(Req, Result);
									const Return = getProfile(Req.cmd.method, Result, Req.cmdProperties?.nodeId) as UserPayloadPackage;
									if (Return && Return.Type === MessageType.EVENT) {
										send({ payload: Return.Event });
										done();
									} else {
										done();
									}
								})
								.catch((Error) => {
									sendTrackingUpdate(Req, Error);
									done(Error);
								});
						} else {
							done(new Error('cmdProperties is either missing or has fewer requied properties.'));
						}
						break;

					case 'NODE':
						if (Req.cmdProperties?.nodeId) {
							self.runtime
								.nodeCommand(Req.cmd.method, Req.cmdProperties.nodeId, Req.cmdProperties.value)
								.then((Result) => {
									sendTrackingUpdate(Req, Result);
									const Return = getProfile(Req.cmd.method, Result, Req.cmdProperties?.nodeId) as UserPayloadPackage;
									if (Return && Return.Type === MessageType.EVENT) {
										send({ payload: Return.Event });
										done();
									} else {
										done();
									}
								})
								.catch((Error) => {
									sendTrackingUpdate(Req, Error);
									done(Error);
								});
						} else {
							done(new Error('Missing cmdProperties.nodeId property.'));
						}
						break;
				}
			} else {
				done(new Error('msg.payload is not a valid command.'));
			}
		});
	};
	RED.nodes.registerType('zwavejs-controller', init);
};
