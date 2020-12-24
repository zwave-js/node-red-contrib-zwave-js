const { ThermostatSetpointType, ThermostatMode } = require("zwave-js");

module.exports = function (RED) {

    // Refs
    const SP = require("serialport");
    const ZW = require('zwave-js')
    const FMaps = require('./FunctionMaps.json')


    function Init(config) {

        const node = this;
        RED.nodes.createNode(this, config);

        node.status({ fill: "yellow", shape: "dot", text: "Starting ZWave Driver..." });

        let DriverOptions = {};
        if (config.encryptionKey != null && config.encryptionKey.length == 16) {

            DriverOptions.networkKey = Buffer.from(config.encryptionKey);
        }

        const Driver = new ZW.Driver(config.serialPort, DriverOptions);

        Driver.on("error", (e) => {
            node.status({ fill: "red", shape: "dot", text: e.message });
        });

        Driver.once("driver ready", () => {

            node.status({ fill: "yellow", shape: "dot", text: "ZWave Driver Ready. Scanning in background..." });

            Driver.controller.nodes.forEach((Node) => {

                Node.on("value updated", (ND, VL) => {
                    Send(ND, VL);
                })

                Node.on("notification", (ND, L, V) => {
                    Send(ND, V);
                })

            });

        });

        Driver.on("all nodes ready", () => {
            node.status({ fill: "green", shape: "dot", text: "ZWave Driver Ready." });
        })

        node.on('close', (done) => {
            Driver.destroy();
            done();

        });

        node.on('input', (msg) => {

            let Class = msg.payload.class;
            let Operation = msg.payload.operation
            let Params = msg.payload.params
            let Node = msg.payload.node;

            if (!FMaps.hasOwnProperty(Class)) {
                node.status({ fill: "red", shape: "dot", text: "Class, " + Class + " not supported." });
                return;
            }

            let Map = FMaps["Basic"]; // CLass

            if (!Map.Operations.hasOwnProperty(Operation)) {
                node.status({ fill: "red", shape: "dot", text: "Unsupported operation : " + Operation + " for class " + Class });
                return;
            }

            let Func = Map.Operations["Get"]; // Operation

            if (Params.length != Func.ParamsRequired || Params.length != (Func.ParamsOptional + Func.ParamsRequired)) {
                node.status({ fill: "red", shape: "dot", text: "Incorrect number of parameters specified for " + Operation });
                return;
            }

            switch (Class) {

                case "Controller":
                    switch (Operation) {
                        case "StartHealNetwork":
                            Driver.controller.beginHealingNetwork();
                            break;

                        case "StopHealNetwork":
                            Driver.controller.stopHealingNetwork();
                            break;

                        case "StartInclusion":
                            Driver.controller.beginInclusion(Param[0]);
                            break;

                        case "StopInclusion":
                            Driver.controller.stopInclusion();
                            break;

                        case "StartExclusion":
                            Driver.controller.beginExclusion();
                            break;

                        case "StopExclusion":
                            Driver.controller.stopExclusion();
                            break;
                    }
                    break;

                default:
                    Driver.controller.nodes.get(Node).commandClasses[Map.MapsToClass][Func.MapsToFunc].apply(Params);
                    break;


            }



        });



        function Send(Node, Value) {
            let PL = {
                "node": Node.id,
                "object": Value,
                "timestamp": new Date()

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