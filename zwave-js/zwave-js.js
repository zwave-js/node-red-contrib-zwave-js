module.exports = function (RED) {
    const SP = require("serialport");
    const ZW = require('zwave-js')




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

        


        node.on('input', async (msg) => {

            let OP = msg.payload.operation;
            let Node = msg.payload.node;
            let Param = msg.payload.operation_vars

            var Response;

            switch (OP) {

                // MGMT
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



                // GETS
                case "GetBattery":
                    Resonse = await Driver.controller.nodes.get(Node).commandClasses.Battery.get();
                    break;

                case "GetConfiguration":
                    Response = await Driver.controller.nodes.get(Node).commandClasses.Configuration.get(Param[0])
                    break;

                case "GetBasic":
                    Response = await Driver.controller.nodes.get(Node).commandClasses.Basic.get()
                    break;

                case "GetBinary":
                    Response = await Driver.controller.nodes.get(Node).commandClasses["Binary Switch"].get()
                    break;

                case "GetWakeInterval":
                    Response = await Driver.controller.nodes.get(Node).commandClasses["Wake Up"].getInterval();
                    break;

                case "GetMultiLevelSwitch":
                    Response = await Driver.controller.nodes.get(Node).commandClasses["Multilevel Switch"].get();
                    break;

                case "GetThermostatMode":
                    Response = await Driver.controller.nodes.get(Node).commandClasses["Thermostat Mode"].get()
                     break;

                case "GetThermostatSetPoint":
                    Response = await Driver.controller.nodes.get(Node).commandClasses["Thermostat Setpoint"].get(Param[0]);
                    break;



                // SETS
                case "SetConfiguration":
                    Driver.controller.nodes.get(Node).commandClasses.Configuration.set(Param[0], Param[1], Param[2])
                    break;

                case "SetThermostatMode":
                    Driver.controller.nodes.get(Node).commandClasses["Thermostat Mode"].set(Param[0])
                    break;

                case "SetThermostatSetPoint":
                    Driver.controller.nodes.get(Node).commandClasses["Thermostat Setpoint"].set(Param[0],Param[1],Param[2])
                    break;

                case "SetBasic":
                    Driver.controller.nodes.get(Node).commandClasses.Basic.set(Param[0])
                    break;

                case "SetBinary":
                    if (Param.length > 1) {
                        Driver.controller.nodes.get(Node).commandClasses["Binary Switch"].set(Param[0], Param[1]);
                    }
                    else {
                        Driver.controller.nodes.get(Node).commandClasses["Binary Switch"].set(Param[0])
                    }
                    break;

                case "SetWakeInterval":
                    Driver.controller.nodes.get(Node).commandClasses["Wake Up"].setInterval(Param[0], 1)
                    break;

                case "SetMultiLevelSwitch":
                    if (Param.length > 1) {
                        Driver.controller.nodes.get(Node).commandClasses["Multilevel Switch"].set(Param[0], Param[1])
                    }
                    else {
                        Driver.controller.nodes.get(Node).commandClasses["Multilevel Switch"].set(Param[0])
                    }
                    break;

                case "SendNotificationReport":
                    let OPS = {
                        "notificationType": Param[0],
                        "notificationEvent": Param[1]
                    }
                    Driver.controller.nodes.get(Node).commandClasses.Notification.sendReport(OPS)
                    break;


            }

            if (Response != null) {
                Send(Driver.controller.nodes.get(Node), Response);
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