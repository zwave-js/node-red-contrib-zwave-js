module.exports = function (RED) {

    // Refs
    const SP = require("serialport");
    const ZW = require('zwave-js')
    const { Message } = require("zwave-js/build/lib/message/Message");
    const FMaps = require('./FunctionMaps.json')
    const Path = require('path')

    const NodeInterviewStage = ["None", "ProtocolInfo", "NodeInfo", "RestartFromCache", "CommandClasses", "OverwriteConfig", "Neighbors", "Complete"]

    function Init(config) {

        const node = this;
        RED.nodes.createNode(this, config);

        node.status({ fill: "red", shape: "dot", text: "Starting ZWave Driver..." });

        let DriverOptions = {};

        // Cache Dir
        DriverOptions.cacheDir = Path.join(RED.settings.userDir, "zwave-js-cache");

        // Timeout (Configurable via UI)
        DriverOptions.timeouts = {};
        DriverOptions.timeouts.ack = config.ackTimeout;
        DriverOptions.timeouts.response = config.controllerTimeout;
        DriverOptions.timeouts.report = config.sendResponseTimeout;
        DriverOptions.timeouts.nodeAwake = config.awakeTime;

        if (config.encryptionKey != null && config.encryptionKey.length == 16) {
            DriverOptions.networkKey = Buffer.from(config.encryptionKey);
        }

        var Driver;

        try {
            Driver = new ZW.Driver(config.serialPort, DriverOptions);
        }
        catch (e) {
            node.error(e);
            return;
        }

        Driver.on("error", (e) => {
            node.error(e);
        });


        Driver.on("all nodes ready", async () => {
            node.status({ fill: "green", shape: "dot", text: "All Nodes Ready!" });
        })

        Driver.once("driver ready", () => {

            // Add, Remove
            Driver.controller.on("node added", (N) => {
                Send(N, "NODE_ADDED")
            })

            Driver.controller.on("node removed", (N) => {
                Send(N, "NODE_REMOVED")
            })

            // Include, Exclude Started
            Driver.controller.on("inclusion started", (Secure) => {
                Send({ id: "Controller" }, "INCLUSION_STARTED", { SecureDevicesOnly: Secure })
            })

            Driver.controller.on("exclusion started", () => {
                Send({ id: "Controller" }, "EXCLUSION_STARTED")
            })

            // Include, Exclude Stopped
            Driver.controller.on("inclusion stopped", () => {
                Send({ id: "Controller" }, "INCLUSION_STOPPED")
            })

            Driver.controller.on("exclusion stopped", () => {
                Send({ id: "Controller" }, "EXCLUSION_STOPPED")
            })

            // Network Heal
            Driver.controller.on("heal network done", () => {
                Send({ id: "Controller" }, "NETWORK_HEAL_DONE")
            })

            let NodesReady = []
            node.status({ fill: "yellow", shape: "dot", text: "Interviewing Nodes..." });

            Driver.controller.nodes.forEach((N1) => {

                N1.on("ready", (N2) => {
                    if (N2.id < 2) {
                        return;
                    }
                    if (NodesReady.indexOf(N2.id) < 0) {
                        NodesReady.push(N2.id);
                    }

                    node.status({ fill: "green", shape: "dot", text: "Nodes : " + NodesReady.toString() + " Are Ready." });
                })

                N1.on("value updated", (ND, VL) => {
                    if (NodesReady.indexOf(ND.id) > -1) {
                        Send(ND, "VALUE_UPDATED", VL);
                    }
                })

                N1.on("notification", (ND, L, VL) => {
                    if (NodesReady.indexOf(ND.id) > -1) {
                        Send(ND, "NOTIFICATION", VL);
                    }
                })

                N1.on("wake up", (ND) => {
                    if (NodesReady.indexOf(ND.id) > -1) {
                        Send(ND, "WAKE_UP");
                    }
                })

                N1.on("sleep", (ND) => {
                    if (NodesReady.indexOf(ND.id) > -1) {
                        Send(ND, "SLEEP");
                    }
                })

                N1.on("interview completed", (ND) => {
                    if (NodesReady.indexOf(ND.id) > -1) {
                        Send(ND, "INTERVIEW_COMPLETE");
                    }
                })

                N1.on("interview failed", (ND, P1, P2) => {
                    if (NodesReady.indexOf(ND.id) > -1) {

                        // Future prep for P1 being removed
                        // We want the more detailed explanation in all cases.
                        var ParamToUse;
                        if (P2 != null) {
                            ParamToUse = P2
                        }
                        else {
                            ParamToUse = P1
                        }

                        Send(ND, "INTERVIEW_FAILED", ParamToUse);
                    }
                })
            });

        });

        node.on('close', (done) => {
            Driver.destroy();
            done();

        });

        node.on('input', async (msg, send, done) => {

            try {
                let Class = msg.payload.class;
                let Operation = msg.payload.operation
                let Params = msg.payload.params
                var Node = msg.payload.node;

                if (Params == null) {
                    Params = []
                }

                // hack to ensure we can capture exceptions on re-interview request
                // when the node is invalid
                if (Class == "Controller" && Operation == "InterviewNode") {
                    Node = Params[0];
                }

                if (Node != null) {
                    if (Driver.controller.nodes.get(Node) == null) {
                        let ErrorMSG = "Node " + Node + " does not exist.";
                        let Er = new Error(ErrorMSG);
                        if (done) {
                            done(Er);
                        }
                        else {
                            node.error(Er);
                        }

                        return;
                    }
                }

                switch (Class) {

                    case "Controller":
                        switch (Operation) {

                            case "GetNodes":
                                let Nodes = {}
                                Driver.controller.nodes.forEach((V, K) => {

                                    Nodes[K] = {
                                        nodeId: V.id,
                                        interviewStage: NodeInterviewStage[V.interviewStage],
                                        isSecure: V.isSecure,
                                        manufacturerId: V.manufacturerId,
                                        productId: V.productId,
                                        productType: V.productType,
                                        neighbors: V.neighbors

                                    }

                                });
                                Send({ id: "Controller" }, "NODE_LIST", Nodes);
                                break;


                            case "InterviewNode":

                                let Stage = NodeInterviewStage[Driver.controller.nodes.get(Node).interviewStage];

                                if (Stage != "Complete") {
                                    let ErrorMSG = "Node " + Node + " is already being interviewed. Current Interview Stage : " + Stage + "";
                                    let Er = new Error(ErrorMSG);
                                    if (done) {
                                        done(Er);
                                    }
                                    else {
                                        node.error(Er);
                                    }

                                    return;
                                }
                                else {
                                    await Driver.controller.nodes.get(Node).refreshInfo();
                                    Send({ id: Node }, "INTERVIEW_STARTED")
                                }

                                break;

                            case "HardReset":
                                await Driver.hardReset();
                                Send({ id: "Controller" }, "CONTROLLER_RESET_COMPLETE")
                                break;

                            case "ProprietaryFunc":

                                let ZWMessage = new Message(Driver, {
                                    type: 0x00,
                                    functionType: Params[0],
                                    payload: Buffer.from(Params[1])
                                });

                                let MessageSettings = {
                                    priority: 2,
                                    supportCheck: false
                                }

                                await Driver.sendMessage(ZWMessage, MessageSettings)
                                break;

                            case "StartHealNetwork":
                                await Driver.controller.beginHealingNetwork();
                                Send({ id: "Controller" }, "NETWORK_HEAL_STARTED")
                                break;

                            case "StopHealNetwork":
                                await Driver.controller.stopHealingNetwork();
                                Send({ id: "Controller" }, "NETWORK_HEAL_STOPPED")
                                break;

                            case "StartInclusion":
                                await Driver.controller.beginInclusion(Params[0]);
                                break;

                            case "StopInclusion":
                                await Driver.controller.stopInclusion();
                                break;

                            case "StartExclusion":
                                await Driver.controller.beginExclusion();
                                break;

                            case "StopExclusion":
                                await Driver.controller.stopExclusion();
                                break;
                        }
                        break;

                    default:

                        if (!FMaps.hasOwnProperty(Class)) {
                            let ErrorMSG = "Class, " + Class + " not supported.";
                            let Er = new Error(ErrorMSG);
                            if (done) {
                                done(Er);
                            }
                            else {
                                node.error(Er);
                            }
                            return;
                        }

                        let Map = FMaps[Class]; // CLass

                        if (!Map.Operations.hasOwnProperty(Operation)) {
                            let ErrorMSG = "Unsupported operation : " + Operation + " for class " + Class;
                            let Er = new Error(ErrorMSG);
                            if (done) {
                                done(Er);
                            }
                            else {
                                node.error(Er);
                            }
                            return;
                        }

                        let Func = Map.Operations[Operation]; // Operation

                        if (Params.length != Func.ParamsRequired || Params.length != (Func.ParamsOptional + Func.ParamsRequired)) {
                            let ErrorMSG = "Incorrect number of parameters specified for " + Operation;
                            let Er = new Error(ErrorMSG);
                            if (done) {
                                done(Er);
                            }
                            else {
                                node.error(Er);
                            }
                            return;
                        }

                        let EP = 0;

                        if (msg.payload.hasOwnProperty("endPoint")) {
                            EP = parseInt(msg.payload.endPoint)
                        }

                        let ZWJSC = Driver.controller.nodes.get(Node).getEndpoint(EP).commandClasses[Map.MapsToClass];
                        await ZWJSC[Func.MapsToFunc].apply(ZWJSC, Params);

                        if (done) {
                            done();
                        }

                        break;
                }
            }
            catch (e) {
                if (done) {
                    done(e);
                }
                else {
                    node.error(e);
                }
            }
        });

        function Send(Node, Subject, Value) {
            let PL = {
                "node": Node.id,
                "event": Subject,
                "timestamp": new Date(),
            }
            if (Value != null) {
                PL.object = Value;
            }
            node.send({ "payload": PL });
        }
        Driver.start()
    }

    RED.nodes.registerType("zwave-js", Init);


    RED.httpAdmin.get("/zwjsgetports", RED.auth.needsPermission('serial.read'), function (req, res) {
        SP.list().then(
            ports => {
                const a = ports.map(p => p.path);
                res.json(a);
            },
            err => {
                node.log('Error listing serial ports', err)
            }
        )
    });

}
