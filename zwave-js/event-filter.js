'use strict';
module.exports = function (RED) {
	function Init(config) {
		RED.nodes.createNode(this, config);
		const node = this;


		node.on('input', Input);

		async function Input(msg, send, done) {

			if(msg.payload !== undefined && msg.payload.event !== undefined){

				const Filters = config.filters;

				Filters.forEach((F) =>{
					if(F.events.length > 0){
						if(F.events.includes(msg.event)){
							if(F.valueIds.length > 0){
								


							}
							else{
								send(msg);
								break;
							}
						}
					}
				})
			}
			
			if (done) {
				done();
			}

		}

		function IsValueIDMatch(ValueID, MSG){

			let Root = MSG.payload;
			if(Root.hasOwnProperty("valueId")){
				Root = MSG.payload.valueId;
			}

			const ValueIDKeys = Object.keys(ValueID)
			const MSGKeys = Object.keys(Root)

			let Match = true

			ValueIDKeys.forEach((VIDK) =>{
				if(MSGKeys.includes(VIDK)){
					if(Root[VIDK] !== ValueID[VIDK]){
						Match = false;
						break;
					}
				}else{
					Match = false;
					break;
				}
			})

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
