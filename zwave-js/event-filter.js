'use strict';
module.exports = function (RED) {
	function Init(config) {
		RED.nodes.createNode(this, config);
		const node = this;


		node.on('input', Input);

		async function Input(msg, send, done) {


			if(msg.payload !== undefined && msg.payload.event !== undefined){
				send(msg);
			}
			else{
				if (done) {
					done();
				}
			}

			
			
		}

		function IsValueIDMatch(ValueID, MSG){

			let Root = MSG.payload;
			if(Root.hasOwnProperty("valueId")){
				Root = MSG.payload.valueId;
			}

			const ValueIDKeys = Object.keys(ValueID)
			const MSGKeys = Object.keys(Root)

			ValueIDKeys.forEach((VIDK) =>{
				if(MSGKeys.includes(VIDK)){
					if(Root[VIDK] !== ValueID[VIDK]){
						return false
					}
				}else{
					return false;
				}
			})
			return true;
		}

		node.on('close', (done) => {
			if (done) {
				done();
			}
		});
	}
	RED.nodes.registerType('event-filter', Init);
};
