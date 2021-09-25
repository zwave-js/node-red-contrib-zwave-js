module.exports = function (RED) {
	const Limiter = require('limiter');
	const LD = require('lodash');
	function Init(config) {
		RED.nodes.createNode(this, config);
		const node = this;

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
			const VarValue = RED.util.evaluateNodeProperty('ZW_NODE_ID', 'env', node);
			if (isNaN(VarValue)) {
				throw new Error("The 'ZW_NODE_ID' variable is not a number.");
			}
			config.filteredNodeId = VarValue;
		}

		if (Array.isArray(config.filteredNodeId)) {
			config.filteredNodeId.forEach((N) => {
				if (Out) RED.events.on(`zwjs:node:event:${N}`, processEventMessage);
			});
			if (config.multicast) {
				node.status({
					fill: 'green',
					shape: 'dot',
					text: 'Mode: Mulitcast'
				});
			} else {
				node.status({
					fill: 'green',
					shape: 'dot',
					text: 'Mode: Multiple'
				});
			}
		} else if (!isNaN(config.filteredNodeId)) {
			if (Out)
				RED.events.on(
					`zwjs:node:event:${config.filteredNodeId}`,
					processEventMessage
				);
			node.status({
				fill: 'green',
				shape: 'dot',
				text: `Mode: Specific Node (${config.filteredNodeId})`
			});
		} else if (config.filteredNodeId === 'All') {
			if (Out) RED.events.on('zwjs:node:event:all', processEventMessage);
			node.status({ fill: 'green', shape: 'dot', text: 'Mode: All Nodes' });
		} else if (config.filteredNodeId === 'AS') {
			node.status({
				fill: 'green',
				shape: 'dot',
				text: 'Mode: As Specifed (Waiting)'
			});
		}

		function processEventMessage(MSG) {
			node.send(MSG);
		}

		node.on('input', Input);
		async function Input(msg, send, done) {
			try {
				// Switch Listener (for AS)
				if (config.filteredNodeId === 'AS') {
					const Node = msg.payload.node;
					if (Node !== DynamicIDListener) {
						RED.events.off(
							`zwjs:node:event:${DynamicIDListener}`,
							processEventMessage
						);
						if (Out)
							RED.events.on(`zwjs:node:event:${Node}`, processEventMessage);
						DynamicIDListener = Node;
						node.status({
							fill: 'green',
							shape: 'dot',
							text: `Mode: As Specifed (${Node})`
						});
					}
				}

				// Override Node - Specifc Node
				if (
					!isNaN(config.filteredNodeId) &&
					!Array.isArray(config.filteredNodeId)
				) {
					msg.payload.node = parseInt(config.filteredNodeId);
				}

				// Multicast
				if (Array.isArray(config.filteredNodeId) && config.multicast) {
					msg.payload.node = [];
					config.filteredNodeId.forEach((N) => {
						msg.payload.node.push(parseInt(N));
					});
					// Multiple
				} else if (
					Array.isArray(config.filteredNodeId) &&
					msg.payload.node !== undefined
				) {
					if (!config.filteredNodeId.includes(msg.payload.node.toString())) {
						const ErrorMSG =
							'Target node is not enabled. Please add this node to the list of nodes to listen to.';
						const Err = new Error(ErrorMSG);
						if (done) {
							done(Err);
						} else {
							node.error(Err);
						}
						return;
					}
				}

				const AllowedModes = ['CCAPI', 'ValueAPI'];
				if (!AllowedModes.includes(msg.payload.mode)) {
					const ErrorMSG = `Only modes: ${AllowedModes} are allowed through this node type.`;
					const Err = new Error(ErrorMSG);
					if (done) {
						done(Err);
					} else {
						node.error(Err);
					}
					return;
				}

				if (
					msg.payload.node === undefined &&
					Array.isArray(config.filteredNodeId)
				) {
					for (let i = 0; i < config.filteredNodeId.length; i++) {
						node.status({
							fill: 'yellow',
							shape: 'dot',
							text: 'Mode: Multiple (Throttling)'
						});
						await RateLimiter.removeTokens(1);
						const TR = LD.cloneDeep(msg);
						TR.payload.node = parseInt(config.filteredNodeId[i]);
						RED.events.emit('zwjs:node:command', TR);
					}
					node.status({
						fill: 'green',
						shape: 'dot',
						text: 'Mode: Multiple'
					});
				} else {
					RED.events.emit('zwjs:node:command', msg);
					if (done) {
						done();
					}
				}
			} catch (Err) {
				const E = new Error(Err.message);
				if (done) {
					done(E);
				} else {
					node.error(E);
				}
				return;
			}
		}

		node.on('close', (done) => {
			if (Array.isArray(config.filteredNodeId)) {
				config.filteredNodeId.forEach((N) => {
					RED.events.off(`zwjs:node:event:${N}`, processEventMessage);
				});
			} else if (!isNaN(config.filteredNodeId)) {
				RED.events.off(
					`zwjs:node:event:${config.filteredNodeId}`,
					processEventMessage
				);
			} else if (config.filteredNodeId === 'All') {
				RED.events.off('zwjs:node:event:all', processEventMessage);
			} else if (config.filteredNodeId === 'AS') {
				RED.events.off(
					`zwjs:node:event:${DynamicIDListener}`,
					processEventMessage
				);
			}

			DynamicIDListener = -1;

			if (done) {
				done();
			}
		});
	}

	RED.nodes.registerType('zwave-device', Init);
};
