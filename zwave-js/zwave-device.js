module.exports = function (RED) {
	const Limiter = require('limiter');
	const LD = require('lodash');
	const { NodeEventEmitter } = require('./events');
	function Init(config) {
		RED.nodes.createNode(this, config);
		const RedNode = this;

		const NetworkIdentifier = config.networkIdentifier || 1;

		function UpdateStatus(Color, Shape, Text) {
			if (config.showStatus === undefined || config.showStatus) {
				RedNode.status({
					fill: Color,
					shape: Shape,
					text: Text
				});
			} else {
				RedNode.status({});
			}
		}

		const LimiterSettings = {
			tokensPerInterval: 1,
			interval: 250
		};

		if (
			config.messagesPerMS !== undefined &&
			!isNaN(config.messagesPerMS) &&
			parseInt(config.messagesPerMS) > 0
		) {
			if (
				config.messageInterval !== undefined &&
				!isNaN(config.messageInterval) &&
				parseInt(config.messageInterval) > 0
			) {
				LimiterSettings.tokensPerInterval = parseInt(config.messagesPerMS);
				LimiterSettings.interval = parseInt(config.messageInterval);
			}
		}

		const RateLimiter = new Limiter.RateLimiter(LimiterSettings);

		let Out = true;
		let DynamicIDListener = -1;
		let DeviceMode;
		let VarNode;

		if (config.datamode !== undefined) {
			switch (config.datamode) {
				case 'Send':
					Out = false;
					break;

				case 'Receive':
					Out = true;
					break;

				default:
					Out = true;
					break;
			}
		}

		if (config.filteredNodeId === 'Var') {
			DeviceMode = 'Var';
			const VarValue = RED.util.evaluateNodeProperty(
				'ZW_NODE_ID',
				'env',
				RedNode
			);
			if (isNaN(VarValue)) {
				throw new Error("The 'ZW_NODE_ID' variable is not a number.");
			}
			VarNode = VarValue;
			if (Out) {
				NodeEventEmitter.on(
					`zwjs:${NetworkIdentifier}:node:event:${VarNode}`,
					processEventMessage
				);
			}
		}

		if (Array.isArray(config.filteredNodeId)) {
			if (Out) {
				config.filteredNodeId.forEach((N) => {
					NodeEventEmitter.on(
						`zwjs:${NetworkIdentifier}:node:event:${N}`,
						processEventMessage
					);
				});
			}
			if (config.multicast) {
				DeviceMode = 'Multicast';
				UpdateStatus('green', 'dot', 'Mode: Multicast');
			} else {
				DeviceMode = 'Multiple';
				UpdateStatus('green', 'dot', 'Mode: Multiple');
			}
		} else if (!isNaN(config.filteredNodeId)) {
			DeviceMode = 'Specific';
			if (Out) {
				NodeEventEmitter.on(
					`zwjs:${NetworkIdentifier}:node:event:${config.filteredNodeId}`,
					processEventMessage
				);
			}
			UpdateStatus(
				'green',
				'dot',
				`Mode: Specific Node (${config.filteredNodeId})`
			);
		} else if (config.filteredNodeId === 'All') {
			DeviceMode = 'All';
			if (Out) {
				NodeEventEmitter.on(
					`zwjs:${NetworkIdentifier}:node:event:all`,
					processEventMessage
				);
			}
			UpdateStatus('green', 'dot', 'Mode: All Nodes');
		} else if (config.filteredNodeId === 'AS') {
			DeviceMode = 'AS';
			UpdateStatus('yellow', 'dot', 'Mode: As Specified (Waiting)');
		}

		function processEventMessage(MSG) {
			RedNode.send(RED.util.cloneMessage(MSG));
		}

		RedNode.on('input', Input);
		function AddIsolatedNodeID(msg) {
			NodeEventEmitter.removeAllListeners(
				`zwjs:${NetworkIdentifier}:node:event:isloated:${RedNode.id}`
			);
			if (
				msg.payload.mode === 'ValueAPI' &&
				msg.payload.method === 'getValue' &&
				config.datamode !== undefined &&
				config.datamode === 'Send/Receive' &&
				config.isolated !== undefined &&
				config.isolated
			) {
				msg.isolatedNodeId = RedNode.id;

				NodeEventEmitter.on(
					`zwjs:${NetworkIdentifier}:node:event:isloated:${RedNode.id}`,
					processEventMessage
				);
			}
		}
		async function Input(msg, send, done) {
			try {
				AddIsolatedNodeID(msg);
				switch (DeviceMode) {
					case 'AS':
						const Node = msg.payload.node;
						if (Node !== DynamicIDListener) {
							NodeEventEmitter.removeListener(
								`zwjs:${NetworkIdentifier}:node:event:${DynamicIDListener}`,
								processEventMessage
							);
							if (Out) {
								NodeEventEmitter.on(
									`zwjs:${NetworkIdentifier}:node:event:${Node}`,
									processEventMessage
								);
							}
							DynamicIDListener = Node;
							UpdateStatus('green', 'dot', `Mode: As Specified (${Node})`);
						}
						break;

					case 'Specific':
						msg.payload.node = parseInt(config.filteredNodeId);
						break;

					case 'Var':
						msg.payload.node = parseInt(VarNode);
						break;

					case 'Multicast':
						msg.payload.node = [];
						config.filteredNodeId.forEach((N) => {
							msg.payload.node.push(parseInt(N));
						});
						break;

					case 'Multiple':
						if (msg.payload.node !== undefined) {
							if (
								!config.filteredNodeId.includes(msg.payload.node.toString())
							) {
								throw new Error('Target node is not in the allowed list.');
							}
						}
						break;
				}

				const AllowedModes = ['CCAPI', 'ValueAPI'];
				if (!AllowedModes.includes(msg.payload.mode)) {
					throw new Error(
						`Only modes: ${AllowedModes} are allowed through this node type.`
					);
				}

				if (DeviceMode === 'Multiple' && msg.payload.node === undefined) {
					for (let i = 0; i < config.filteredNodeId.length; i++) {
						UpdateStatus('yellow', 'dot', 'Mode: Multiple (Throttling)');

						await RateLimiter.removeTokens(1);
						const TR = LD.cloneDeep(msg);
						TR.payload.node = parseInt(config.filteredNodeId[i]);
						NodeEventEmitter.emit(`zwjs:${NetworkIdentifier}:node:command`, TR);
					}
					UpdateStatus('green', 'dot', 'Mode: Multiple');
				} else {
					NodeEventEmitter.emit(`zwjs:${NetworkIdentifier}:node:command`, msg);
				}
				if (done) {
					done();
				}
			} catch (Err) {
				const E = new Error(Err.message);
				if (done) {
					done(E);
				} else {
					RedNode.error(E);
				}
				return;
			}
		}

		RedNode.on('close', (done) => {
			NodeEventEmitter.removeAllListeners(
				`zwjs:${NetworkIdentifier}:node:event:isloated:${RedNode.id}`
			);

			switch (DeviceMode) {
				case 'Specific':
					NodeEventEmitter.removeListener(
						`zwjs:${NetworkIdentifier}:node:event:${config.filteredNodeId}`,
						processEventMessage
					);
					break;

				case 'Var':
					NodeEventEmitter.removeListener(
						`zwjs:${NetworkIdentifier}:node:event:${VarNode}`,
						processEventMessage
					);
					break;

				case 'Multiple':
				case 'Multicast':
					config.filteredNodeId.forEach((N) => {
						NodeEventEmitter.removeListener(
							`zwjs:${NetworkIdentifier}:node:event:${N}`,
							processEventMessage
						);
					});
					break;

				case 'All':
					NodeEventEmitter.removeListener(
						`zwjs:${NetworkIdentifier}:node:event:all`,
						processEventMessage
					);
					break;

				case 'AS':
					NodeEventEmitter.removeListener(
						`zwjs:${NetworkIdentifier}:node:event:${DynamicIDListener}`,
						processEventMessage
					);
					break;
			}

			DynamicIDListener = -1;

			if (done) {
				done();
			}
		});
	}

	RED.nodes.registerType('zwave-device', Init);
};
