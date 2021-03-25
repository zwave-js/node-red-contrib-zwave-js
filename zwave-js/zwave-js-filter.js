module.exports = function (RED) {


    function Init(config) {

        const node = this;
        RED.nodes.createNode(this, config);

        
        RED.events.on("zwjs:node:event:" + config.filteredNodeId, (MSG) => {
            delete MSG.payload.node;
            node.send(MSG)
        })
        

        node.status({ fill: "green", shape: "dot", text: "Filtered to Node: "+config.filteredNodeId });

        node.on('input', Input);

        async function Input(msg, send, done) {

            msg.payload.node = parseInt(config.filteredNodeId);
            RED.events.emit("zwjs:node:command", msg);

            if (done) {
                done()
            }

        }

    }

    RED.nodes.registerType("zwave-js-filter", Init);


}
