module.exports = function (RED) {


    function Init(config) {

        RED.nodes.createNode(this, config);
        const node = this;

        let DynamicIDListener = -1;

        if (Array.isArray(config.filteredNodeId)) {
            config.filteredNodeId.forEach((N) => {
                RED.events.on("zwjs:node:event:" + N, processEventMessage)
            })
            if (config.multicast) {
                node.status({ fill: "green", shape: "dot", text: "Mode: Mulitcast (" + config.filteredNodeId + ")" });
            }
            else {
                node.status({ fill: "green", shape: "dot", text: "Mode: Multiple (" + config.filteredNodeId + ")" });
            }
        } else if (!isNaN(config.filteredNodeId)) {
            RED.events.on("zwjs:node:event:" + config.filteredNodeId, processEventMessage)
            node.status({ fill: "green", shape: "dot", text: "Mode: Specific Node (" + config.filteredNodeId + ")" });
        } else if (config.filteredNodeId === "All") {
            RED.events.on("zwjs:node:event:all", processEventMessage)
            node.status({ fill: "green", shape: "dot", text: "Mode: All Nodes" });
        } else if (config.filteredNodeId === "AS") {
            node.status({ fill: "green", shape: "dot", text: "Mode: As Specifed (Waiting)" });
        }

        function processEventMessage(MSG) {
            node.send(MSG)
        }

        node.on('input', Input);
        async function Input(msg, send, done) {

            try {
                // Switch Listener (for AS)
                if (config.filteredNodeId === "AS") {

                    let Node = msg.payload.node
                    if (Node !== DynamicIDListener) {
                        RED.events.off("zwjs:node:event:" + DynamicIDListener, processEventMessage)
                        RED.events.on("zwjs:node:event:" + Node, processEventMessage)
                        DynamicIDListener = Node
                        node.status({ fill: "green", shape: "dot", text: "Mode: As Specifed (" + Node + ")" });
                    }
                }

                // Override Node - Specifc Node
                if (!isNaN(config.filteredNodeId) && !Array.isArray(config.filteredNodeId)) {
                    msg.payload.node = parseInt(config.filteredNodeId)
                }

                // Multicast
                if (Array.isArray(config.filteredNodeId) && config.multicast) {

                    msg.payload.node = [];
                    config.filteredNodeId.forEach((N) => {
                        msg.payload.node.push(parseInt(N))
                    })
                    // Multiple
                } else if (Array.isArray(config.filteredNodeId)) {

                    if (!config.filteredNodeId.includes(msg.payload.node.toString())) {

                        let ErrorMSG = "Target node is not enabled. Please add this node to the list of nodes to listen to.";
                        let Err = new Error(ErrorMSG);
                        if (done) {
                            done(Err)
                        }
                        else {
                            node.error(Err);
                        }
                        return;
                    }
                }

                let AllowedModes = ["CCAPI", "ValueAPI"]
                if (!AllowedModes.includes(msg.payload.mode)) {

                    let ErrorMSG = "Only modes: " + AllowedModes + " are allowed through this node type.";
                    let Err = new Error(ErrorMSG);
                    if (done) {
                        done(Err)
                    }
                    else {
                        node.error(Err);
                    }
                    return;
                }

                RED.events.emit("zwjs:node:command", msg);
                if (done) {
                    done()
                }
            }
            catch (Err) {
                let E = new Error(Err.message);
                if (done) {
                    done(E)
                }
                else {
                    node.error(E);
                }
                return;
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
            } else if (config.filteredNodeId === "AS") {
                RED.events.off("zwjs:node:event:" + DynamicIDListener, processEventMessage)
            }

            DynamicIDListener = -1

            if (done) {
                done();
            }

        });
    }

    RED.nodes.registerType("zwave-device", Init);
}
