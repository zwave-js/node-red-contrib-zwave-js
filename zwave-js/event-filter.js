module.exports = function (RED) {
	const LD = require('lodash');

	function Init(config) {
		RED.nodes.createNode(this, config);
		const node = this;

		node.on('input', Input);

		function compare(a, b) {
			if (a.index < b.index) {
				return -1;
			}
			if (a.index > b.index) {
				return 1;
			}
			return 0;
		}

		async function Input(msg, send, done) {
			const SendingArray = new Array(config.filters.length);

			if (
				msg.payload !== undefined &&
				msg.payload.event !== undefined &&
				msg.payload.node !== undefined
			) {
				const Filters = config.filters;
				let Matched = false;

				let ArrayIndex = -1;

				for (const Filter of Filters.sort(compare)) {
					ArrayIndex++;
					if (Filter.events.length > 0) {
						if (Filter.events.includes(msg.payload.event)) {
							if (Filter.valueIds.length > 0) {
								for (const ValueID of Filter.valueIds) {
									if (IsValueIDMatch(ValueID, msg, msg.payload.event)) {
										msg.filter = Filter;
										SendingArray[ArrayIndex] = msg;
										node.status({
											fill: 'green',
											shape: 'dot',
											text: 'Last match: ' + Filter.name
										});
										send(SendingArray);
										Matched = true;
										break;
									}
								}
								if (Matched) {
									break;
								}
							} else {
								msg.filter = Filter;
								SendingArray[ArrayIndex] = msg;
								node.status({
									fill: 'green',
									shape: 'dot',
									text: 'Last match: ' + Filter.name
								});
								Matched = true;
								send(SendingArray);
								break;
							}
						}
					}
				}

				if (!Matched) {
					node.status({
						fill: 'yellow',
						shape: 'dot',
						text: 'No match'
					});
				}
			} else {
				node.status({
					fill: 'red',
					shape: 'dot',
					text: 'Not a ZWave message'
				});
			}

			if (done) {
				done();
			}
		}

		function IsValueIDMatch(ValueID, MSG, Event) {
			let Root = MSG.payload.object;

			if (Event === 'GET_VALUE_RESPONSE') {
				Root = Root.valueId;
				if (!config.strict) {
					delete ValueID['endpoint'];
				}
				const Result = LD.isMatch(Root, ValueID);
				return Result;
			}

			if (Event === 'VALUE_UPDATED') {
				if (!config.strict) {
					delete ValueID['endpoint'];
				}
				const Result = LD.isMatch(Root, ValueID);
				return Result;
			}

			if (Event === 'NOTIFICATION') {
				const Result = LD.isMatch(Root, ValueID);
				return Result;
			}

			if (Event === 'VALUE_NOTIFICATION') {
				if (!config.strict) {
					delete ValueID['endpoint'];
				}
				const Result = LD.isMatch(Root, ValueID);
				return Result;
			}
		}

		node.on('close', (done) => {
			if (done) {
				done();
			}
		});
	}
	RED.nodes.registerType('event-filter', Init);
};
