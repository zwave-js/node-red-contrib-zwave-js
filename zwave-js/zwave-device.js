module.exports = function (RED) {


    function Init(config) {

        const node = this;
        RED.nodes.createNode(this, config);

        node.status({ fill: "red", shape: "dot", text: "ZWave Node: "+config.filteredNodeId+" not ready." });

        RED.events.on("zwjs:node:ready:" + config.filteredNodeId,processReadyMessage)
        function processReadyMessage(){
            node.status({ fill: "green", shape: "dot", text: "ZWave Node: "+config.filteredNodeId+" ready!" });
        }

        RED.events.on("zwjs:node:event:" + config.filteredNodeId, processEventMessage)
        function processEventMessage(MSG){
            node.send(MSG)
        }
        
        RED.events.emit("zwjs:node:checkready",config.filteredNodeId);

        node.on('input', Input);
        async function Input(msg, send, done) {

            if(msg.payload.class === "Controller"){

                let ErrorMSG = "Controller commands must be sent directly to the Controller Node.";
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
            RED.events.removeListener("zwjs:node:ready:" + config.filteredNodeId,processReadyMessage);
            RED.events.removeListener("zwjs:node:event:" + config.filteredNodeId, processEventMessage);
            if (done) {
                done();
            }

        });      
    }

    RED.nodes.registerType("zwave-device", Init);
}
