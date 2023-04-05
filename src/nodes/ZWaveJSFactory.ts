import { NodeAPI, NodeMessage, NodeMessageInFlow } from 'node-red';
import { Type_ZWaveJSFactory, Type_ZWaveJSFactoryConfig } from '../types/Type_ZWaveJSFactory';
import { InputMessage } from '../types/Type_ZWaveJSController';
import { CommandClasses } from '@zwave-js/core';

module.exports = (RED: NodeAPI) => {
	const init = function (this: Type_ZWaveJSFactory, config: Type_ZWaveJSFactoryConfig) {
		const self = this;
		RED.nodes.createNode(self, config);
		self.config = config;

		const ValueAPI = (
			msg: NodeMessageInFlow,
			send: (msg: NodeMessage | Array<NodeMessage | NodeMessage[] | null>) => void,
			done: (err?: Error) => void
		) => {
			let ValueID;
			let Value;
			let NodeID;
			let Options;
			let TrackingToken;

			if (config.trackingToken) {
				const EXP = RED.util.prepareJSONataExpression(config.trackingToken, self);
				TrackingToken = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (config.valueId) {
				const EXP = RED.util.prepareJSONataExpression(config.valueId, self);
				ValueID = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (config.nodeId) {
				const EXP = RED.util.prepareJSONataExpression(config.nodeId, self);
				NodeID = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (config.method === 'setValue') {
				if (config.value) {
					const EXP = RED.util.prepareJSONataExpression(config.value, self);
					Value = RED.util.evaluateJSONataExpression(EXP, msg);
				}

				if (config.valueSetOptions) {
					const EXP = RED.util.prepareJSONataExpression(config.valueSetOptions, self);
					Options = RED.util.evaluateJSONataExpression(EXP, msg);
				}
			}

			if (!ValueID) {
				done(new Error('Missing Value ID expression, or expression yields undefined.'));
				return;
			}

			if (!NodeID) {
				done(new Error('Missing Node ID expression, or expression yields undefined.'));
				return;
			}

			if (config.method === 'setValue' && !Value) {
				done(new Error('Missing Value expression, or expression yields undefined.'));
			}

			const CMD: InputMessage = {
				cmd: {
					api: 'VALUE',
					method: config.method
				},
				cmdProperties: {
					nodeId: NodeID,
					valueId: ValueID
				}
			};

			if (TrackingToken) {
				CMD.cmd.trackingToken = TrackingToken;
			}

			if (Value) {
				CMD.cmdProperties!.value = Value;
			}

			if (Options) {
				CMD.cmdProperties!.setValueOptions = Options;
			}

			send({ payload: CMD });
			done();
		};

		const CCAPI = (
			msg: NodeMessageInFlow,
			send: (msg: NodeMessage | Array<NodeMessage | NodeMessage[] | null>) => void,
			done: (err?: Error) => void
		) => {
			let NodeID;
			let Endpoint;
			let Args;
			let TrackingToken;

			if (config.trackingToken) {
				const EXP = RED.util.prepareJSONataExpression(config.trackingToken, self);
				TrackingToken = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (config.nodeId) {
				const EXP = RED.util.prepareJSONataExpression(config.nodeId, self);
				NodeID = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (config.endpoint) {
				const EXP = RED.util.prepareJSONataExpression(config.endpoint, self);
				Endpoint = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (config.args) {
				const EXP = RED.util.prepareJSONataExpression(config.args, self);
				Args = RED.util.evaluateJSONataExpression(EXP, msg);
			}

			if (!NodeID) {
				done(new Error('Missing Node ID expression, or expression yields undefined.'));
				return;
			}

			if (!config.commandClass) {
				done(new Error('Missing Command Class.'));
				return;
			}

			if (!config.method) {
				done(new Error('Missing Command Class method.'));
				return;
			}

			const CMD: InputMessage = {
				cmd: {
					api: 'CC',
					method: 'invokeCCAPI'
				},
				cmdProperties: {
					nodeId: NodeID,
					method: config.method
				}
			};

			if (TrackingToken) {
				CMD.cmd.trackingToken = TrackingToken;
			}

			CMD.cmdProperties!.commandClass = CommandClasses[config.commandClass as keyof typeof CommandClasses];

			if (Endpoint) {
				CMD.cmdProperties!.endpoint = Endpoint;
			}

			if (Args) {
				CMD.cmdProperties!.args = Args;
			}

			send({ payload: CMD });
			done();
		};

		self.on('input', (msg, send, done) => {
			switch (config.api) {
				case 'VALUE':
					ValueAPI(msg, send, done);
					break;

				case 'CC':
					CCAPI(msg, send, done);
					break;
			}
		});

		self.on('close', (_: boolean, done: () => void) => {
			done();
		});
	};

	RED.nodes.registerType('zwavejs-factory', init);
};
