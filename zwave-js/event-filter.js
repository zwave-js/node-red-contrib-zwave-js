'use strict';
module.exports = function (RED) {
	function Init(config) {
		RED.nodes.createNode(this, config);
		const node = this;

		node.on('input', Input);

		async function Input(msg, send, done) {
			const SendingArray = new Array(config.filters.length);

			if (msg.payload !== undefined && msg.payload.event !== undefined) {
				const Filters = config.filters;
				let Matched = false;

				let ArrayIndex = -1;

				for (const Filter of Filters) {
					ArrayIndex++;
					if (Filter.events.length > 0) {
						if (Filter.events.includes(msg.payload.event)) {
							if (Filter.valueIds.length > 0) {
								for (const ValueID of Filter.valueIds) {
									if (IsValueIDMatch(ValueID, msg, msg.payload.event === 'GET_VALUE_RESPONSE')) {
										msg.filter = Filter;
										SendingArray[ArrayIndex] = msg;
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
								send(SendingArray);
								break;
							}
						}
					}
				}
			}

			if (done) {
				done();
			}
		}

		function IsValueIDMatch(ValueID, MSG, Response) {
			let Root = MSG.payload.object;
			if(Response){
				Root = MSG.payload.object.valueId;
			}
			
			let ValueIDKeys = Object.keys(ValueID);
			const MSGKeys = Object.keys(Root);

			if (!config.strict) {
				ValueIDKeys = ValueIDKeys.filter((K) => K !== 'endpoint');
			}

			let Match = true;

			for (const VIDK of ValueIDKeys) {
				if (MSGKeys.includes(VIDK)) {
					if (Root[VIDK] !== ValueID[VIDK]) {
						Match = false;
						break;
					}
				} else {
					Match = false;
					break;
				}
			}
			return Match;
		}

		node.on('close', (done) => {
			if (done) {
				done();
			}
		});
	}
	RED.nodes.registerType('event-filter', Init);
};
