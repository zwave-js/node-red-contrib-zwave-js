module.exports = function (RED) {


    function Init(config) {
        
        const node = this;
        RED.nodes.createNode(this, config);

        if (Array.isArray(config.filteredNodeId)) {
            config.filteredNodeId.forEach((N) => {
                RED.events.on("zwjs:node:event:" + N, processEventMessage)
            })
        } else if (!isNaN(config.filteredNodeId)) {
            RED.events.on("zwjs:node:event:" + config.filteredNodeId, processEventMessage)
        } else if (config.filteredNodeId === "All") {
            RED.events.on("zwjs:node:event:all", processEventMessage)
        }

        function processEventMessage(MSG){
            node.send(MSG)
        }
        
        node.on('input', Input);
        async function Input(msg, send, done) {

          
            let AllowedModes = ["CCAPI","ValueAPI"]

            if(!AllowedModes.includes(msg.payload.mode)){

                let ErrorMSG = "Only modes: "+AllowedModes+" are allowed through this node type.";
                let Err =  new Error(ErrorMSG);

                if (done) {
                    done(Err)
                }
                else{
                    node.error(Err);
                }

                return;
            }

            msg.payload.node = parseInt(config.filteredNodeId);
            RED.events.emit("zwjs:node:command", msg);
            if (done) {
                done()
            }
        }

        node.on('close', (done) => {

           
            if (Array.isArray(config.filteredNodeId)) {
                config.filteredNodeId.forEach((N) => {
                    RED.events.off("zwjs:node:event:" + N, processEventMessage)
                })
            } else if (!isNaN(config.filteredNodeId)) {
                RED.events.off("zwjs:node:event:" + config.filteredNodeId, processEventMessage)
            } else if (config.filteredNodeId === "All") {
                RED.events.off("zwjs:node:event:all", processEventMessage)
            }

            if (done) {
                done();
            }

        });      
    }

    RED.nodes.registerType("zwave-device", Init);
}
