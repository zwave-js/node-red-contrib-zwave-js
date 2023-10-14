import { NodeAPI } from 'node-red';
import { UserPayloadPackage, Type_ZWaveJSRuntime, MessageType } from '../types/Type_ZWaveJSRuntime';
import { Type_ZWaveJSDevice, Type_ZWaveJSDeviceConfig, InputMessage } from '../types/Type_ZWaveJSDevice';
import { getProfile } from '../lib/RequestResponseProfiles';

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
			const Req = msg.payload as InputMessage;

			if (self.config.nodeMode === 'All' && !Req.cmdProperties?.nodeId) {
				done(new Error('Missing cmdProperties.nodeId property.'));
			} else {
				if (Req.cmdProperties?.nodeId) {
					switch (Req.cmd.api) {
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
				}
			}
		});
	};

	RED.nodes.registerType('zwavejs-device', init);
};
