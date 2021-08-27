'use strict';
module.exports = function (RED) {
	function Init(config) {
		RED.nodes.createNode(this, config);
		const node = this;


		node.on('input', Input);

		async function Input(msg, send, done) {

			if(msg.payload !== undefined && msg.payload.event !== undefined){

				const Filters = config.filters;
				let Matched = false

				for (const Filter of Filters) {
					if(Filter.events.length > 0){
						if(Filter.events.includes(msg.payload.event)){
							if(Filter.valueIds.length > 0){
								for (const ValueID of Filter.valueIds) {
									if(IsValueIDMatch(ValueID,msg)){
										msg.filter = Filter
										send(msg)
										Matched = true;
										break;
									}
								}
								if(Matched){
									break;
								}
							}
							else{
								msg.filter = Filter
								send(msg)
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

		function IsValueIDMatch(ValueID, MSG){

			let Root = MSG.payload;
			if(Root.hasOwnProperty("valueId") && Root.hasOwnProperty("response") ){
				Root = MSG.payload.valueId;
			}

			const ValueIDKeys = Object.keys(ValueID)
			const MSGKeys = Object.keys(Root)

			if(!config.strict){
				ValueIDKeys = ValueIDKeys.filter((K) => K !== 'endpoint');
			}

			let Match = true

			for(const VIDK of ValueIDKeys){
				if(MSGKeys.includes(VIDK)){
					if(Root[VIDK] !== ValueID[VIDK]){
						Match = false
						break;
					}
				}
				else{
					Match = false
					break
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
