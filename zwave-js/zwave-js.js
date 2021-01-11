module.exports = function (RED)
{
    // Refs
    const SP = require("serialport");
    const ZW = require('zwave-js')
    const { Message } = require("zwave-js/build/lib/message/Message");
    const { Duration } = require("@zwave-js/core");
    const FMaps = require('./FunctionMaps.json')
    const EnumLookup = require('./Enums.json')
    const Path = require('path')

    function Init(config)
    {
        const node = this;
        RED.nodes.createNode(this, config);
        
        node.status({ fill: "red", shape: "dot", text: "Starting ZWave Driver..." });

        let DriverOptions = {};

        // Cache Dir
        DriverOptions.cacheDir = Path.join(RED.settings.userDir, "zwave-js-cache");

        // Timeout (Configurable via UI)
        DriverOptions.timeouts = {};
        DriverOptions.timeouts.ack = parseInt(config.ackTimeout);
        DriverOptions.timeouts.response = parseInt(config.controllerTimeout);
        DriverOptions.timeouts.report = parseInt(config.sendResponseTimeout);
        DriverOptions.timeouts.nodeAwake = parseInt(config.awakeTime);

        if (config.encryptionKey != null && config.encryptionKey.length == 16)
        {
            DriverOptions.networkKey = Buffer.from(config.encryptionKey);
        }

        var Driver;

        try
        {
            Driver = new ZW.Driver(config.serialPort, DriverOptions);
        }
        catch (e)
        {
            node.error(e);
            return;
        }

        Driver.on("error", (e) =>
        {
            node.error(e);
        });

        Driver.on("all nodes ready", () =>
        {
            node.status({ fill: "green", shape: "dot", text: "All Nodes Ready!" });
        })

        Driver.once("driver ready", () =>
        {
            let ReturnController = { id: "Controller" };

            // Add, Remove
            Driver.controller.on("node added", (N) =>
            {
                Send(N, "NODE_ADDED")
            })

            Driver.controller.on("node removed", (N) =>
            {
                Send(N, "NODE_REMOVED")
            })

            // Include, Exclude Started
            Driver.controller.on("inclusion started", (Secure) =>
            {
                Send(ReturnController, "INCLUSION_STARTED", { SecureDevicesOnly: Secure })
            })

            Driver.controller.on("exclusion started", () =>
            {
                Send(ReturnController, "EXCLUSION_STARTED")
            })

            // Include, Exclude Stopped
            Driver.controller.on("inclusion stopped", () =>
            {
                Send(ReturnController, "INCLUSION_STOPPED")
            })

            Driver.controller.on("exclusion stopped", () =>
            {
                Send(ReturnController, "EXCLUSION_STOPPED")
            })

            // Network Heal
            Driver.controller.on("heal network done", () =>
            {
                Send(ReturnController, "NETWORK_HEAL_DONE")
            })

            let NodesReady = []
            node.status({ fill: "yellow", shape: "dot", text: "Interviewing Nodes..." });
            Driver.controller.nodes.forEach((N1) =>
            {
                N1.on("ready", (N2) =>
                {
                    if (N2.id < 2)
                    {
                        return;
                    }
                    if (NodesReady.indexOf(N2.id) < 0)
                    {
                        NodesReady.push(N2.id);
                    }

                    node.status({ fill: "green", shape: "dot", text: "Nodes : " + NodesReady.toString() + " Are Ready." });
                })

                N1.on("value updated", (ND, VL) =>
                {
                    if (NodesReady.indexOf(ND.id) > -1)
                    {
                        Send(ND, "VALUE_UPDATED", VL);
                    }
                })

                N1.on("value added", (ND, VL) =>
                {
                    if (NodesReady.indexOf(ND.id) > -1)
                    {
                        Send(ND, "VALUE_UPDATED", VL);
                    }
                })

                N1.on("value notification", (ND, VL) =>
                {
                    if (NodesReady.indexOf(ND.id) > -1)
                    {
                        Send(ND, "VALUE_UPDATED", VL);
                    }
                })

                N1.on("notification", (ND, L, VL) =>
                {
                    if (NodesReady.indexOf(ND.id) > -1)
                    {
                        Send(ND, "NOTIFICATION", VL);
                    }
                })

                N1.on("wake up", (ND) =>
                {
                    if (NodesReady.indexOf(ND.id) > -1)
                    {
                        Send(ND, "WAKE_UP");
                    }
                })

                N1.on("sleep", (ND) =>
                {
                    if (NodesReady.indexOf(ND.id) > -1)
                    {
                        Send(ND, "SLEEP");
                    }
                })

                N1.on("interview completed", (ND) =>
                {
                    if (NodesReady.indexOf(ND.id) > -1)
                    {
                        Send(ND, "INTERVIEW_COMPLETE");
                    }
                })

                N1.on("interview failed", (ND, P1, P2) =>
                {
                    if (NodesReady.indexOf(ND.id) > -1)
                    {
                        var ParamToUse;
                        if (P2 != null)
                        {
                            ParamToUse = P2
                        }
                        else
                        {
                            ParamToUse = P1
                        }

                        Send(ND, "INTERVIEW_FAILED", ParamToUse);
                    }
                })
            });

        });

        node.on('close', (done) =>
        {
            Driver.destroy();
            if(done)
            {
                done();
            }
        });

        node.on('input', async (msg, send, done) =>
        {
            try
            {
                let Class = msg.payload.class;

                switch (Class)
                {
                    case "Controller":
                        await Controller(msg, send)
                        break;

                    case "Unmanaged":
                        await Unmanaged(msg, send);
                        break;

                    default:
                        await NodeFunction(msg, send);
                        break;
                }

                if (done)
                {
                    done()
                }
            }
            catch (er)
            {
                if (done)
                {
                    done(er);
                }
                else
                {
                    node.error(er);
                }
            }
        });

        function NodeCheck(ID)
        {
            if (Driver.controller.nodes.get(ID) == null)
            {
                let ErrorMSG = "Node " + ID + " does not exist.";
                throw new Error(ErrorMSG);
            }
        }

        // Node
        async function NodeFunction(msg, send)
        {
            let Operation = msg.payload.operation
            let Class = msg.payload.class;
            let Node = msg.payload.node;
            let Params = msg.payload.params;

            let ReturnNode = { id: Node };

            if (!FMaps.hasOwnProperty(Class))
            {
                let ErrorMSG = "Class, " + Class + " not supported.";
                throw new Error(ErrorMSG);
            }

            let Map = FMaps[Class];

            if (!Map.Operations.hasOwnProperty(Operation))
            {
                let ErrorMSG = "Unsupported operation : " + Operation + " for class " + Class;
                throw new Error(ErrorMSG);
            }

            let Func = Map.Operations[Operation];

            if (Params.length != Func.ParamsRequired && Params.length != (Func.ParamsOptional + Func.ParamsRequired))
            {
                let ErrorMSG = "Incorrect number of parameters specified for " + Operation;
                throw new Error(ErrorMSG);
            }

            let EP = 0;

            if (msg.payload.hasOwnProperty("endPoint"))
            {
                EP = parseInt(msg.payload.endPoint)
            }

            if (Func.hasOwnProperty("ParamEnumDependency"))
            {
                for (let i = 0; i < Params.length; i++)
                {
                    if (Func.ParamEnumDependency.hasOwnProperty(i))
                    {
                        let Enum = Func.ParamEnumDependency[i];
                        Params[i] = EnumLookup[Enum][Params[i]]
                    }
                }
            }

            if (Params.length > 0)
            {
                for (let i = 0; i < Params.length; i++)
                {
                    if (typeof Params[i] == 'object')
                    {
                        if (Params[i].hasOwnProperty("Duration"))
                        {
                            let D = new Duration(Params[i].Duration.value, Params[i].Duration.unit)
                            Params[i] = D;
                        }
                    }
                }
            }

            let ZWJSC = Driver.controller.nodes.get(Node).getEndpoint(EP).commandClasses[Map.MapsToClass];

            if (Func.hasOwnProperty("ResponseThroughEvent") && !Func.ResponseThroughEvent)
            {
                let Result = await ZWJSC[Func.MapsToFunc].apply(ZWJSC, Params);
                Send(ReturnNode, "VALUE_UPDATED", Result, send)
            }
            else
            {
                await ZWJSC[Func.MapsToFunc].apply(ZWJSC, Params);
            }

            return;
        }

        // Unmanaged
        async function Unmanaged(msg, send)
        {
            let Operation = msg.payload.operation
            let Node = msg.payload.node;
            let Params = msg.payload.params;

            let ReturnNode = { id: Node };

            NodeCheck(Node);

            switch (Operation)
            {
                case "GetDefinedValueIDs":
                    const VIDs = Driver.controller.nodes.get(Node).getDefinedValueIDs();
                    Send(ReturnNode, "VALUE_ID_LIST", VIDs, send);
                    break;

                case "SetValue":
                    Driver.controller.nodes.get(Node).setValue(Params[0], Params[1]);
                    break;

                case "GetValue":
                    let V = Driver.controller.nodes.get(Node).getValue(Params[0]);
                    Send(ReturnNode, "VALUE_UPDATED", V, send);
                    break;
            }

            return;
        }

        // Controller
        async function Controller(msg, send)
        {
            let Operation = msg.payload.operation
            let Node = msg.payload.node;
            let Params = msg.payload.params;

            let ReturnController = { id: "Controller" };
            let ReturnNode = { id: Node };

            switch (Operation)
            {
                case "GetNodes":
                    Driver.controller.nodes.forEach((V, K) =>
                    {
                        Nodes[K] =
                        {
                            nodeId: V.id,
                            interviewStage: ZW.InterviewStage[V.interviewStage],
                            isSecure: V.isSecure,
                            manufacturerId: V.manufacturerId,
                            productId: V.productId,
                            productType: V.productType,
                            neighbors: V.neighbors
                        }
                    });
                    Send(ReturnController, "NODE_LIST", Nodes, send);
                    break;

                case "InterviewNode":
                    NodeCheck(Params[0]);
                    let Stage = ZW.InterviewStage[Driver.controller.nodes.get(Params[0]).interviewStage];
                    if (Stage != "Complete")
                    {
                        let ErrorMSG = "Node " + Params[0] + " is already being interviewed. Current Interview Stage : " + Stage + "";
                        throw new Error(ErrorMSG);
                    }
                    else
                    {
                        await Driver.controller.nodes.get(Node).refreshInfo();
                        Send(ReturnNode, "INTERVIEW_STARTED", null, send)
                    }
                    break;

                case "HardReset":
                    await Driver.hardReset();
                    Send(ReturnController, "CONTROLLER_RESET_COMPLETE", null, send)
                    break;

                case "StartHealNetwork":
                    await Driver.controller.beginHealingNetwork();
                    Send(ReturnController, "NETWORK_HEAL_STARTED", null, send)
                    break;

                case "StopHealNetwork":
                    await Driver.controller.stopHealingNetwork();
                    Send(ReturnController, "NETWORK_HEAL_STOPPED", null, send)
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

            return;
        }

        function Send(Node, Subject, Value, send)
        {
            let PL = { "node": Node.id, "event": Subject, "timestamp": new Date() }

            if (Value != null)
            {
                PL.object = Value;
            }

            if (send)
            {
                send({ "payload": PL })
            }
            else
            {
                node.send({ "payload": PL });
            }
        }

        Driver.start()
    }

    RED.nodes.registerType("zwave-js", Init);

    RED.httpAdmin.get("/zwjsgetports", RED.auth.needsPermission('serial.read'), function (req, res)
    {
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
