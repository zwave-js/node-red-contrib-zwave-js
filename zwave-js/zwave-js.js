module.exports = function (RED) {
    const SP = require("serialport");
    const FMaps = require('./FunctionMaps.json')
    const Path = require('path')
    const ModulePackage = require('../package.json')
    const ZWaveJS = require('zwave-js')
    const { Duration, createDefaultTransportFormat } = require("@zwave-js/core");
    const { Message } = require("zwave-js/build/lib/message/Message"); // to replace with proper export
    const ZWaveJSPackage = require('zwave-js/package.json')
    const Winston = require("winston");

    const UI = require('./ui/server.js')
    UI.init(RED)

    // Z-Wave JS Enum Lookups
    const Enums = {

        // CC enums
        RateType: ZWaveJS.RateType,
        ColorComponent: ZWaveJS.ColorComponent,
        SetbackType: ZWaveJS.SetbackType,
        BinarySensorType: ZWaveJS.BinarySensorType,
        ThermostatMode: ZWaveJS.ThermostatMode,
        ThermostatSetpointType: ZWaveJS.ThermostatSetpointType,
        DoorLockMode: ZWaveJS.DoorLockMode,

        // node enums
        InterviewStage: ZWaveJS.InterviewStage,
        NodeStatus: ZWaveJS.NodeStatus,
        ProtocolVersion: ZWaveJS.ProtocolVersion
    }

    let NodeList = []; // used by HTTP Get Nodes (for device nodes)
    var Logger;
    var FileTransport; // Needed for Z-Wave JS logging.

    // Log function
    const Log = function(level,entity,direction,tag1,msg,tag2){

        if(Logger !== undefined){

            let logEntry = {
                direction: "  ",
                message: msg,
                level: level,
                label: entity,
                timestamp: new Date().toJSON(),
                multiline:Array.isArray(msg)
            }
            if (direction.length > 0) {
                logEntry.direction = direction === "IN" ? "« " : "» "
            }

            if (tag1 !== undefined) {
                logEntry.primaryTags = "["+tag1+"]"
            }

            if (tag2 !== undefined) {
                logEntry.secondaryTags = tag2
            }

            Logger.log(logEntry)
        }

    }

    function Init(config) {

        const node = this;
        let canDoSecure = false;
        const NodesReady = [];
        RED.nodes.createNode(this, config);

        // Create Logger (if enabled)
        if (config.logLevel !== "none") {

            Logger = Winston.createLogger({level:config.logLevel});

            let FileTransportOptions = {
                filename: Path.join(RED.settings.userDir, "zwave-js-log.txt"),
                format:createDefaultTransportFormat(false,false)
            }
            if (config.logFile !== undefined && config.logFile.length > 0) {
                FileTransportOptions.filename = config.logFile
            }

            FileTransport = new Winston.transports.File(FileTransportOptions)
            Logger.add(FileTransport)
        }

        
        

        node.status({ fill: "red", shape: "dot", text: "Starting ZWave Driver..." });

        Log("silly","MODULE","",undefined,"Registering event -> 'zwjs:node:command'")
        RED.events.on("zwjs:node:command",processMessageEvent);
        async function processMessageEvent(MSG){
            Log("debug","USRFLO","OUT","DEVMOD","Received event 'zwjs:node:command'. Forwarding to input.")
            await Input(MSG,undefined,undefined,true)
        }

        Log("silly","MODULE","",undefined,"Registering event -> 'zwjs:node:checkready'")
        RED.events.on("zwjs:node:checkready",processReadyRequest);
        async function processReadyRequest(NID){
            Log("debug","DEVMOD","OUT","MODULE","Received event 'zwjs:node:checkready'. Processing.","[Node: "+NID+"]")
            if(NodesReady.indexOf(parseInt(NID)) > -1){
                RED.events.emit("zwjs:node:ready:" + NID);
                Log("debug","DEVMOD","IN","MODULE","Responding to event 'zwjs:node:checkready'", "[Node: "+NID+"]")
            }
        }

    
        /*
          Some Params need a little bit of magic. i.e converting to a class

          Key should be Class.Operation
          Value should be a reference to a method that is able to manipulate the params[] object,
          and return the modifed param array.
          the method signature should be (Class Name, Operation Name, object[])
        */
        const CCParamConverters = {
            "BinarySwitch.Set": ProcessDurationClass,
            "MultiLevelSwitch.Set": ProcessDurationClass,
            "Meter.Get": ParseMeterOptions
        }

        Log("silly","MODULE","",undefined,"Generating Driver options")
        let DriverOptions = {};

        // Logging
        DriverOptions.logConfig = {};
        if (Logger !== undefined) {

            DriverOptions.logConfig.enabled = true;

            if (config.logNodeFilter !== undefined && config.logNodeFilter.length > 0) {
                Log("silly","MODULE","IN","OPTIONS","Z-Wave JS Log Node Filter: "+config.logNodeFilter)
                let Nodes = config.logNodeFilter.split(",")
                let NodesArray = [];
                Nodes.forEach((N) => {
                    NodesArray.push(parseInt(N))
                })
                DriverOptions.logConfig.nodeFilter = NodesArray;
            }

            DriverOptions.logConfig.transports = [FileTransport]
        }
        else {
            DriverOptions.logConfig.enabled = false;
        }

        // Cache Dir
        DriverOptions.storage = {};
        DriverOptions.storage.cacheDir = Path.join(RED.settings.userDir, "zwave-js-cache");

        // Timeout (Configurable via UI)
        DriverOptions.timeouts = {};
        if (config.ackTimeout !== undefined && config.ackTimeout.length > 0) {
            Log("debug","MODULE","IN","OPTIONS","ACK timeout set to: "+config.ackTimeout)
            DriverOptions.timeouts.ack = parseInt(config.ackTimeout);
        }
        if (config.controllerTimeout !== undefined && config.controllerTimeout.length > 0) {
            Log("debug","MODULE","IN","OPTIONS","Controller timeout set to: "+config.controllerTimeout)
            DriverOptions.timeouts.response = parseInt(config.controllerTimeout);
        }
        if (config.sendResponseTimeout !== undefined && config.sendResponseTimeout.length > 0) {
            Log("debug","MODULE","IN","OPTIONS","Report timeout set to: "+config.sendResponseTimeout)
            DriverOptions.timeouts.report = parseInt(config.sendResponseTimeout);
        }


        if (config.encryptionKey !== undefined && config.encryptionKey.length > 0 && config.encryptionKey.startsWith('[') && config.encryptionKey.endsWith(']')) {

            let RemoveBrackets = config.encryptionKey.replace("[", "").replace("]", "");
            let _Array = RemoveBrackets.split(",");

            Log("debug","MODULE","IN","OPTIONS","Encryption key provided as Array","("+_Array.length+" bytes)")

            let _Buffer = [];
            for (let i = 0; i < _Array.length; i++) {
                _Buffer.push(parseInt(_Array[i].trim()));
            }

            DriverOptions.networkKey = Buffer.from(_Buffer);
            canDoSecure = true;

        }
        else if (config.encryptionKey !== undefined && config.encryptionKey.length > 0) {

            Log("debug","MODULE","IN","OPTIONS","Encryption key provided as String","("+config.encryptionKey.length+" characters)")

            DriverOptions.networkKey = Buffer.from(config.encryptionKey);
            canDoSecure = true;
        }

        var Driver;

        try {
            Log("info","MODULE","",undefined,"Instantiating Z-Wave JS Driver","("+config.serialPort+")")
            Driver = new ZWaveJS.Driver(config.serialPort, DriverOptions);
            
        }
        catch (e) {
            Log("error","ERROR ","OUT","MODULE",e.message)
            node.error(e);
            return;
        }

        UI.register(Driver, Input)

        Log("silly","MODULE","",undefined,"Registering driver event -> 'error'")
        Driver.on("error", (e) => {
            Log("error","ERROR ","OUT","MODULE",e.message)
            node.error(e);
        });

        Log("silly","MODULE","",undefined,"Registering driver event -> 'all nodes ready'")
        Driver.on("all nodes ready", () => {
            node.status({ fill: "green", shape: "dot", text: "All Nodes Ready!" });
        })

        Log("silly","MODULE","",undefined,"Registering driver event -> 'driver ready'")
        Driver.once("driver ready", () => {

            node.status({ fill: "yellow", shape: "dot", text: "Interviewing Nodes..." });

            let ReturnController = { id: "Controller" };

            // Add, Remove
            Driver.controller.on("node added", (N) => {
                ShareNodeList();
                WireNodeEvents(N);
                Send(N, "NODE_ADDED")
            })

            Driver.controller.on("node removed", (N) => {
                ShareNodeList();
                Send(N, "NODE_REMOVED")
            })

            // Include, Exclude Started
            Driver.controller.on("inclusion started", (Secure) => {
                Send(ReturnController, "INCLUSION_STARTED", { isSecureInclude: Secure })
            })

            Driver.controller.on("exclusion started", () => {
                Send(ReturnController, "EXCLUSION_STARTED")
            })

            // Include, Exclude Stopped
            Driver.controller.on("inclusion stopped", () => {
                Send(ReturnController, "INCLUSION_STOPPED")
            })

            Driver.controller.on("exclusion stopped", () => {
                Send(ReturnController, "EXCLUSION_STOPPED")
            })

            // Network Heal
            Driver.controller.on("heal network done", () => {
                Send(ReturnController, "NETWORK_HEAL_DONE")
            })

            ShareNodeList();

            Driver.controller.nodes.forEach((ZWN) => {
                WireNodeEvents(ZWN);
            });

        });

        node.on('close', (done) => {

            Log("info","MODULE","",undefined,"Cleaning up environment")

            UI.unregister(Driver.controller.homeId)
            Driver.destroy();
            RED.events.removeListener("zwjs:node:checkready",processReadyRequest);
            RED.events.removeListener("zwjs:node:command",processMessageEvent);
            if (done) {
                done();
            }
            
        });

        node.on('input', Input);

        function ShareNodeList(){
            Log("silly","MODULE","OUT","DEVMOD","Refreshing node list.")
            NodeList.length = 0;
            Driver.controller.nodes.forEach((ZWN) => {
                let Node = {
                    id: ZWN.id,
                    name: ZWN.name !== undefined ? ZWN.name : "No Name",
                    isController: ZWN.isControllerNode()
                }
                NodeList.push(Node)
            });
        }

        function WireNodeEvents(Node) {

            Log("silly","MODULE","",undefined,"Registering node events","[Node: "+Node.id+"]")

            Node.on("ready", (N) => {

                if (N.isControllerNode()) {
                    return;
                }

                if (NodesReady.indexOf(N.id) < 0) {
                    NodesReady.push(N.id);
                    node.status({ fill: "green", shape: "dot", text: "Nodes : " + NodesReady.toString() + " Are Ready." });

                    Log("silly","MODULE","OUT","DEVMOD","Sending event 'zwjs:node:ready:"+N.id+"'")

                    RED.events.emit("zwjs:node:ready:" + N.id);
                }

                Node.on("value notification", (N, VL) => {
                    Send(N, "VALUE_NOTIFICATION", VL);
                })

                Node.on("notification", (N, CC, ARGS) => {
                    let OBJ = {
                        ccId: CC,
                        args: ARGS
                    }
                    Send(N, "NOTIFICATION", OBJ);
                })

                Node.on("value added", (N, VL) => {
                    Send(N, "VALUE_UPDATED", VL);
                })

                Node.on("value updated", (N, VL) => {
                    Send(N, "VALUE_UPDATED", VL);
                })

                Node.on("wake up", (N) => {
                    Send(N, "WAKE_UP");
                })

                Node.on("sleep", (N) => {
                    Send(N, "SLEEP");
                })

            })


            Node.on("interview completed", (N) => {
                Send(N, "INTERVIEW_COMPLETE");
            })

            Node.on("interview failed", (N, Er) => {
                Send(N, "INTERVIEW_FAILED", Er);
            })
        }

        async function Input(msg, send, done, internal) {
            try {

                let PLKeys = Object.keys(msg.payload);
                let OBJArray = [];

                OBJArray.push("│")
                PLKeys.forEach((K) =>{
                    OBJArray.push("│ "+(K + ": ").padEnd(12,' ')+msg.payload[K]);
                })
                OBJArray.push("└─")


                if(internal){
                    Log("debug","DEVMOD","OUT","MODULE",["Received message from event"].concat(OBJArray));
                }
                else{
                    Log("debug","USRFLO","OUT","MODULE",["Received message from flow"].concat(OBJArray));
                }
  


                let Class = msg.payload.class;

                switch (Class) {
                    case "Controller":
                        await Controller(msg, send)
                        break;

                    case "Unmanaged":
                        await Unmanaged(msg, send);
                        break;

                    case "Driver":
                        await DriverCMD(msg, send);
                        break;

                    default:
                        await NodeFunction(msg, send);
                        break;
                }

                if (done) {
                    done()
                }
            }
            catch (er) {
                Log("error","ERROR ","OUT","FLOMSG",er.message);
                if (done) {
                    done(er);
                }
                else {
                    node.error(er);
                }
            }
        };

        function NodeCheck(ID) {

            if (Driver.controller.nodes.get(ID) === undefined) {
                let ErrorMSG = "Node " + ID + " does not exist.";
                throw new Error(ErrorMSG);
            }

            if (!Driver.controller.nodes.get(ID).ready) {
                let ErrorMSG = "Node " + ID + " is not yet ready, to receive commands.";
                throw new Error(ErrorMSG);
            }
        }

        // Node
        async function NodeFunction(msg, send) {
            let Operation = msg.payload.operation
            let Class = msg.payload.class;
            let Node = msg.payload.node;
            var Params = msg.payload.params || [];

            let ReturnNode = { id: Node };

            NodeCheck(Node);

            if (!FMaps.hasOwnProperty(Class)) {
                let ErrorMSG = "Class, " + Class + " not supported.";
                throw new Error(ErrorMSG);
            }

            let Map = FMaps[Class];

            if (!Map.Operations.hasOwnProperty(Operation)) {
                let ErrorMSG = "Unsupported operation : " + Operation + " for class " + Class;
                throw new Error(ErrorMSG);
            }

            let Func = Map.Operations[Operation];

            if (Params.length !== Func.ParamsRequired && Params.length !== (Func.ParamsOptional + Func.ParamsRequired)) {
                let ErrorMSG = "Incorrect number of parameters specified for " + Operation;
                throw new Error(ErrorMSG);
            }

            let EP = 0;

            if (msg.payload.hasOwnProperty("endpoint")) {
                EP = parseInt(msg.payload.endpoint)
            } else if (msg.payload.hasOwnProperty("endPoint")) {
                EP = parseInt(msg.payload.endPoint)
            }

            if (Func.hasOwnProperty("ParamEnumDependency")) {
                for (let i = 0; i < Params.length; i++) {
                    if (Func.ParamEnumDependency.hasOwnProperty(i.toString())) {
                        let Enum = Func.ParamEnumDependency[i.toString()];
                        Params[i] = Enums[Enum][Params[i]]
                    }
                }
            }

            if (CCParamConverters.hasOwnProperty(Class + "." + Operation)) {
                let Handler = CCParamConverters[Class + "." + Operation];
                Params = Handler(Class, Operation, Params);
            }

            let ZWJSC = Driver.controller.nodes.get(Node).getEndpoint(EP).commandClasses[Map.MapsToClass];

            if (Func.hasOwnProperty("ResponseThroughEvent") && !Func.ResponseThroughEvent) {
                let Result = await ZWJSC[Func.MapsToFunc].apply(ZWJSC, Params);
                Send(ReturnNode, "VALUE_UPDATED", Result, send)
            }
            else {
                await ZWJSC[Func.MapsToFunc].apply(ZWJSC, Params);
            }

            return;
        }

        // Driver
        async function DriverCMD(msg,send){

            let Operation = msg.payload.operation;
            let ReturnNode = { id: "N/A" };

            switch(Operation){
                case "GetEnums":
                    Send(ReturnNode, "ENUM_LIST", Enums, send);
                    break;
            }
        }

        // Unmanaged
        async function Unmanaged(msg, send) {
            let Operation = msg.payload.operation
            let Node = msg.payload.node;
            let Params = msg.payload.params;

            let ReturnNode = { id: Node };

            NodeCheck(Node);

            switch (Operation) {
                case "GetDefinedValueIDs":
                    const VIDs = Driver.controller.nodes.get(Node).getDefinedValueIDs();
                    Send(ReturnNode, "VALUE_ID_LIST", VIDs, send);
                    break;

                case "SetValue":
                    await Driver.controller.nodes.get(Node).setValue(Params[0], Params[1]);
                    break;

                case "GetValue":
                    let V = Driver.controller.nodes.get(Node).getValue(Params[0]);

                    let ReturnObject = {
                        response: V,
                        valueId: Params[0]
                    }
                    Send(ReturnNode, "GET_VALUE_RESPONSE", ReturnObject, send);
                    break;

                case "GetValueMetadata":
                    let M = Driver.controller.nodes.get(Node).getValueMetadata(Params[0]);

                    let ReturnObjectM = {
                        response: M,
                        valueId: Params[0]
                    }
                    Send(ReturnNode, "GET_VALUE_METADATA_RESPONSE", ReturnObjectM, send);
                    break;
            }

            return;
        }

        // Controller
        async function Controller(msg, send) {
            let Operation = msg.payload.operation
            let Params = msg.payload.params;

            let ReturnController = { id: "Controller" };
            let ReturnNode = { id: "" };

            switch (Operation) {
                case "GetNodes":
                    let Nodes = [];
                    Driver.controller.nodes.forEach((N, NI) => {

                        Nodes.push({
                            nodeId: N.id,
                            name: N.name,
                            location: N.location,
                            status: Enums.NodeStatus[N.status],
                            ready: N.ready,
                            interviewStage: Enums.InterviewStage[N.interviewStage],
                            zwavePlusVersion: N.zwavePlusVersion,
                            zwavePlusNodeType: N.zwavePlusNodeType,
                            zwavePlusRoleType: N.zwavePlusRoleType,
                            isListening: N.isListening,
                            isFrequentListening: N.isFrequentListening,
                            canSleep: N.canSleep,
                            isRouting: N.isRouting,
                            supportedDataRates: N.supportedDataRates,
                            maxDataRate: N.maxDataRate,
                            supportsSecurity: N.supportsSecurity,
                            isSecure: N.isSecure,
                            protocolVersion: Enums.ProtocolVersion[N.protocolVersion],
                            manufacturerId: N.manufacturerId,
                            productId: N.productId,
                            productType: N.productType,
                            firmwareVersion: N.firmwareVersion,
                            neighbors: N.neighbors,
                            deviceConfig: N.deviceConfig,
                            isControllerNode: N.isControllerNode(),
                            supportsBeaming:N.supportsBeaming
                        })

                    });
                    Send(ReturnController, "NODE_LIST", Nodes, send);
                    break;

                case "SetNodeName":
                    NodeCheck(Params[0])
                    Driver.controller.nodes.get(Params[0]).name = Params[1]
                    ReturnNode.id = Params[0]
                    Send(ReturnNode, "NODE_NAME_SET", Params[1], send)
                    ShareNodeList();
                    break

                case "SetNodeLocation":
                    NodeCheck(Params[0])
                    Driver.controller.nodes.get(Params[0]).location = Params[1]
                    ReturnNode.id = Params[0]
                    Send(ReturnNode, "NODE_LOCATION_SET", Params[1], send)
                    break

                case "InterviewNode":
                    Params[0] = +Params[0]
                    NodeCheck(Params[0]);
                    let Stage = Enums.InterviewStage[Driver.controller.nodes.get(Params[0]).interviewStage];
                    if (Stage !== "Complete") {
                        let ErrorMSG = "Node " + Params[0] + " is already being interviewed. Current Interview Stage : " + Stage + "";
                        throw new Error(ErrorMSG);
                    }
                    else {
                        await Driver.controller.nodes.get(Params[0]).refreshInfo();
                        ReturnNode.id = Params[0];
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

                case "RemoveFailedNode":
                    await Driver.controller.removeFailedNode(Params[0]);
                    break;

                case "StartInclusion":
                    if (!canDoSecure) {
                        await Driver.controller.beginInclusion(true);
                    }
                    else if (Params !== undefined && Params.length > 0) {
                        await Driver.controller.beginInclusion(Params[0]);
                    }
                    else {
                        await Driver.controller.beginInclusion(false);
                    }
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

                case "ProprietaryFunc":

                    let ZWMessage = new Message(Driver, {
                        type: 0x00,
                        functionType: Params[0],
                        payload: Params[1]
                    });

                    let MessageSettings = {
                        priority: 2,
                        supportCheck: false
                    }

                    await Driver.sendMessage(ZWMessage, MessageSettings)
                    break;
            }

            return;
        }

        function Send(Node, Subject, Value, send) {

            let PL = { "node": Node.id, "event": Subject, "timestamp": new Date().toJSON() }

            if (Value !== undefined) {
                PL.object = Value;
            }

            let PLKeys = Object.keys(PL);
            let OBJArray = [];
            OBJArray.push("│")
            PLKeys.forEach((K) =>{
                OBJArray.push("│ "+(K + ": ").padEnd(12,' ')+PL[K]);
            })
            OBJArray.push("└─")

            Log("debug","USRFLO","IN","MODULE",["Forwarding event to the flow"].concat(OBJArray));

            if (send) {
                send({ "payload": PL })
            }
            else {
                node.send({ "payload": PL });
            }

            // Allow passing event to filter nodes
            if(Node.id !== "Controller"){
                Log("silly","DEVMOD","IN","MODULE",["Forwarding event out as an event"].concat(OBJArray));
                RED.events.emit("zwjs:node:event:"+Node.id,{ "payload": PL })
            }
        }

        // Duration Fix
        function ProcessDurationClass(Class, Operation, Params) {

            Log("debug","MODULE","",undefined,"Checking for Duration Object");

            if (Params.length > 0) {
                for (let i = 0; i < Params.length; i++) {
                    if (typeof Params[i] === "object") {
                        let Keys = Object.keys(Params[i]);
                        if (Keys.length === 1) {
                            if (Keys[0] === "Duration") {
                                let D = new Duration(Params[i].Duration.value, Params[i].Duration.unit)
                                Params[i] = D;

                                let ArrayMSG = ["Duration class instance created: Param "+i];
                                ArrayMSG.push("│")
                                ArrayMSG.push("│ "+("Value: ").padEnd(12,' ')+Params[i].Duration.value);
                                ArrayMSG.push("│ "+("Unit: ").padEnd(12,' ')+Params[i].Duration.unit);
                                ArrayMSG.push("└─")
                                
                                Log("debug","MODULE","",undefined,ArrayMSG);
                            }
                        }
                    }
                }

            }
            return Params;
        }

        // Meter Fix
        function ParseMeterOptions(Class, Operation, Params) {
            Log("debug","MODULE","",undefined,"Parsing METER -> GET Params");
            if (typeof Params[0] === "object") {
                Params[0].rateType = Enums.RateType[Params[0].rateType];
                Log("debug","MODULE","",undefined,"Meter Get type set to: "+Params[0].rateType);
            }
            return Params;
        }

        Driver.start()
            .catch((e) => {
                Log("error","ERROR ","OUT","MODULE",e.message)
                node.error(e);

            })
    }

    RED.nodes.registerType("zwave-js", Init);

    RED.httpAdmin.get("/zwjsgetnodelist", function (req, res) {
        res.json(NodeList)
    })

    RED.httpAdmin.get("/zwjsgetversion", function (req, res) {
        res.json({ "zwjsversion": ZWaveJSPackage.version, "moduleversion": ModulePackage.version })
    })

    RED.httpAdmin.get("/zwjsgetports", RED.auth.needsPermission('serial.read'), function (req, res) {
        SP.list()
            .then(ports => {
                const a = ports.map(p => p.path);
                res.json(a);
            })
            .catch(err => {
                RED.log.error('Error listing serial ports', err)
                res.json([]);
            })

    });
}
