module.exports = function (RED) {
    const SP = require("serialport");
    const FMaps = require('./FunctionMaps.json')
    const Path = require('path')
    const ModulePackage = require('../package.json')
    const ZWaveJS = require('zwave-js')
    const { Duration, createDefaultTransportFormat, CommandClasses } = require("@zwave-js/core");
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
        SetPointType: ZWaveJS.ThermostatSetpointType,
        DoorLockMode: ZWaveJS.DoorLockMode,
        AlarmSensorType: ZWaveJS.AlarmSensorType,
        BarrierState:ZWaveJS.BarrierState,
        SubsystemType:ZWaveJS.SubsystemType,
        SubsystemState:ZWaveJS.SubsystemState,
        UserIDStatus:ZWaveJS.UserIDStatus,
        KeypadMode:ZWaveJS.KeypadMode,
        Weekday:ZWaveJS.Weekday,

        // Controller Enums
        RFRegion: ZWaveJS.RFRegion,

        // node enums
        InterviewStage: ZWaveJS.InterviewStage,
        NodeStatus: ZWaveJS.NodeStatus,
        ProtocolVersion: ZWaveJS.ProtocolVersion
    }

    let NodeList = []; // used by HTTP Get Nodes (for device nodes)
    var Logger;
    var FileTransport; // Needed for Z-Wave JS logging.

    // Log function
    const Log = function (level, label, direction, tag1, msg, tag2) {

        if (Logger !== undefined) {
            let logEntry = {
                direction: "  ",
                message: msg,
                level: level,
                label: label,
                timestamp: new Date().toJSON(),
                multiline: Array.isArray(msg)
            }
            if (direction !== undefined) {
                logEntry.direction = (direction === "IN" ? "« " : "» ")
            }
            if (tag1 !== undefined) {
                logEntry.primaryTags = tag1
            }
            if (tag2 !== undefined) {
                logEntry.secondaryTags = tag2
            }
            Logger.log(logEntry)
        }
    }

    function Init(config) {

        RED.nodes.createNode(this, config);
        const node = this;
        let canDoSecure = false;
        const NodesReady = [];
        let AllNodesReady = false;
        var Driver;

        var RestoreReadyTimer;
        function RestoreReadyStatus(){
            RestoreReadyTimer = setTimeout(()=>{
                if(AllNodesReady){
                    node.status({ fill: "green", shape: "dot", text: "All Nodes Ready!" });
                    UI.status("All Nodes Ready!")
                }
                else{
                    node.status({ fill: "green", shape: "dot", text: "Nodes : " + NodesReady.toString() + " Are Ready." });
                    UI.status("Nodes : " + NodesReady.toString() + " Are Ready." )
                }
            },5000);
        }

        // Create Logger (if enabled)
        if (config.logLevel !== "none") {

            Logger = Winston.createLogger();

            let FileTransportOptions = {
                filename: Path.join(RED.settings.userDir, "zwave-js-log.txt"),
                format: createDefaultTransportFormat(false, false),
                level: config.logLevel
            }
            if (config.logFile !== undefined && config.logFile.length > 0) {
                FileTransportOptions.filename = config.logFile
            }

            FileTransport = new Winston.transports.File(FileTransportOptions)
            Logger.add(FileTransport)
        }

        node.status({ fill: "red", shape: "dot", text: "Starting Z-Wave Driver..." });
        UI.status("Starting Z-Wave Driver...")

        RED.events.on("zwjs:node:command", processMessageEvent);
        async function processMessageEvent(MSG) {
            await Input(MSG, undefined, undefined, true)
        }

        RED.events.on("zwjs:node:checkready", processReadyRequest);
        async function processReadyRequest(NID) {
            if (NodesReady.indexOf(parseInt(NID)) > -1) {
                RED.events.emit("zwjs:node:ready:" + NID);
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

        let DriverOptions = {};

        // Logging
        DriverOptions.logConfig = {};
        if (Logger !== undefined) {

            DriverOptions.logConfig.enabled = true;

            if (config.logNodeFilter !== undefined && config.logNodeFilter.length > 0) {
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

        
        DriverOptions.storage = {};

        // Cache Dir
        DriverOptions.storage.cacheDir = Path.join(RED.settings.userDir, "zwave-js-cache");

        // Custom  Config Path
        if(config.customConfigPath !== undefined && config.customConfigPath.length > 0){
            Log("debug", "REDCTL", undefined, "[OPTIONS] [storage.deviceConfigPriorityDir]", config.customConfigPath)
            DriverOptions.storage.deviceConfigPriorityDir = config.customConfigPath
        }

        // Disk throttle
        if(config.valueCacheDiskThrottle !== undefined && config.valueCacheDiskThrottle.length > 0){
            Log("debug", "REDCTL", undefined, "[OPTIONS] [storage.throttle]", config.valueCacheDiskThrottle)
            DriverOptions.storage.throttle = config.valueCacheDiskThrottle
        }

        // Timeout 
        DriverOptions.timeouts = {};
        if (config.ackTimeout !== undefined && config.ackTimeout.length > 0) {
            Log("debug", "REDCTL", undefined, "[OPTIONS] [timeouts.ack]", config.ackTimeout)
            DriverOptions.timeouts.ack = parseInt(config.ackTimeout);
        }
        if (config.controllerTimeout !== undefined && config.controllerTimeout.length > 0) {
            Log("debug", "REDCTL", undefined, "[OPTIONS] [timeouts.response] ", config.controllerTimeout)
            DriverOptions.timeouts.response = parseInt(config.controllerTimeout);
        }
        if (config.sendResponseTimeout !== undefined && config.sendResponseTimeout.length > 0) {
            Log("debug", "REDCTL", undefined, "[OPTIONS] [timeouts.report]", config.sendResponseTimeout)
            DriverOptions.timeouts.report = parseInt(config.sendResponseTimeout);
        }

        if (config.encryptionKey !== undefined && config.encryptionKey.length > 0 && config.encryptionKey.startsWith('[') && config.encryptionKey.endsWith(']')) {

            let RemoveBrackets = config.encryptionKey.replace("[", "").replace("]", "");
            let _Array = RemoveBrackets.split(",");

            let _Buffer = [];
            for (let i = 0; i < _Array.length; i++) {
                _Buffer.push(parseInt(_Array[i].trim()));
            }

            Log("debug", "REDCTL", undefined, "[OPTIONS] [networkKey]", "Provided as Number[]", "(" + _Buffer.length + " bytes)")
            DriverOptions.networkKey = Buffer.from(_Buffer);
            canDoSecure = true;
        }
        else if (config.encryptionKey !== undefined && config.encryptionKey.length > 0) {

            Log("debug", "REDCTL", undefined, "[OPTIONS] [networkKey]", "Provided as String", "(" + config.encryptionKey.length + " characters)")
            DriverOptions.networkKey = Buffer.from(config.encryptionKey);
            canDoSecure = true;
        }

        try {

            Log("info", "REDCTL", undefined, undefined, "Instantiating 'Driver' class", "(" + config.serialPort + ")")
            Driver = new ZWaveJS.Driver(config.serialPort, DriverOptions);

            if (config.sendUsageStatistics !== undefined && config.sendUsageStatistics) {
                Log("info", "REDCTL", undefined, "[TELEMETRY]", "Enabling analytics reporting")
                Driver.enableStatistics({ applicationName: ModulePackage.name, applicationVersion: ModulePackage.version })
            }
            else {
                Log("info", "REDCTL", undefined, "[TELEMETRY]", "Disabling analytics reporting")
                Driver.disableStatistics();
            }
        }
        catch (e) {
            Log("error", "REDCTL", undefined, "[ERROR] [INIT]", "Instantiating 'Driver' failed: " + e.message)
            node.error(e);
            return;
        }

        UI.register(Driver, Input)

        Driver.on("error", (e) => {
            Log("error", "REDCTL", undefined, "[ERROR] [EVENT]", "'Driver' threw: " + e.message)
            node.error(e);
        });

        Driver.on("all nodes ready", () => {
            node.status({ fill: "green", shape: "dot", text: "All Nodes Ready!" });
            AllNodesReady = true;
            UI.status("All Nodes Ready!")
        })

        Driver.once("driver ready", () => {

            node.status({ fill: "yellow", shape: "dot", text: "Interviewing Nodes..." });
            UI.status("Interviewing Nodes...")

            let ReturnController = { id: "Controller" };

            // Add, Remove
            Driver.controller.on("node added", (N) => {
                clearTimeout(RestoreReadyTimer)
                ShareNodeList();
                WireNodeEvents(N);
                Send(N, "NODE_ADDED")
                Send(N, "INTERVIEW_STARTED");
                node.status({ fill: "yellow", shape: "dot", text: "Node: "+N.id+" Interview Started."});
                UI.status("Node: "+N.id+" Interview Started.")
            })

            Driver.controller.on("node removed", (N) => {
                ShareNodeList();
                Send(N, "NODE_REMOVED")
            })

            // Include
            Driver.controller.on("inclusion started", (Secure) => {
                Send(ReturnController, "INCLUSION_STARTED", { isSecureInclude: Secure })
                node.status({ fill: "yellow", shape: "dot", text: "Inclusion Started. Secure: "+Secure });
                UI.status("Inclusion Started. Secure: "+Secure)
            })

            Driver.controller.on("inclusion failed", () => {
                Send(ReturnController, "INCLUSION_FAILED")
                node.status({ fill: "red", shape: "dot", text: "Inclusion Failed."});
                UI.status("Inclusion Failed.")
                RestoreReadyStatus();
            })

            Driver.controller.on("inclusion stopped", () => {
                Send(ReturnController, "INCLUSION_STOPPED")
                node.status({ fill: "green", shape: "dot", text: "Inclusion Stopped."});
                UI.status("Inclusion Stopped.")
                RestoreReadyStatus();
            })

            // Exclusion
            Driver.controller.on("exclusion started", () => {
                Send(ReturnController, "EXCLUSION_STARTED")
                node.status({ fill: "yellow", shape: "dot", text: "Exclusion Started."});
                UI.status("Exclusion Started.")
            })

            Driver.controller.on("exclusion failed", () => {
                Send(ReturnController, "EXCLUSION_FAILED")
                node.status({ fill: "red", shape: "dot", text: "Exclusion Failed."});
                UI.status("Exclusion Failed.")
                RestoreReadyStatus();
            })
          
            Driver.controller.on("exclusion stopped", () => {
                Send(ReturnController, "EXCLUSION_STOPPED")
                node.status({ fill: "green", shape: "dot", text: "Exclusion Stopped."});
                UI.status("Exclusion Stopped.")
                RestoreReadyStatus();
            })

            // Network Heal
            Driver.controller.on("heal network done", () => {
                Send(ReturnController, "NETWORK_HEAL_DONE",{Successful:Heal_Done,Failed:Heal_Failed, Skipped:Heal_Skipped})
                node.status({ fill: "green", shape: "dot", text: "Network Heal Done."});
                UI.status("Network Heal Done.")
                RestoreReadyStatus();
            })

            let Heal_Pending = []
            let Heal_Done = []
            let Heal_Failed = []
            let Heal_Skipped = []

            Driver.controller.on("heal network progress", (P) => {

                Heal_Pending.length = 0;
                Heal_Done.length = 0;
                Heal_Failed.length = 0;
                Heal_Skipped.length = 0;

                P.forEach((V,K) =>{
                    switch(V){
                        case "pending":
                            Heal_Pending.push(K)
                            break
                        case "done":
                            Heal_Done.push(K)
                            break
                        case "failed":
                            Heal_Failed.push(K)
                            break
                        case "skipped":
                            Heal_Skipped.push(K)
                            break
                    }
                })
                node.status({ fill: "yellow", shape: "dot", text: "Healing Network Pending:["+Heal_Pending.toString()+"], Done:["+Heal_Done.toString()+"], Skipped:["+Heal_Skipped.toString()+"], Failed:["+Heal_Failed.toString()+"]"});
                UI.status("Healing Network Pending:["+Heal_Pending.toString()+"], Done:["+Heal_Done.toString()+"], Skipped:["+Heal_Skipped.toString()+"], Failed:["+Heal_Failed.toString()+"]")
            })

            ShareNodeList();

            Driver.controller.nodes.forEach((ZWN) => {
                WireNodeEvents(ZWN);
            });

        });

        node.on('close', (done) => {

            Log("info", "REDCTL", undefined, undefined, "Cleaning up")

            UI.unregister()
            Driver.destroy();
            RED.events.removeListener("zwjs:node:checkready", processReadyRequest);
            RED.events.removeListener("zwjs:node:command", processMessageEvent);
            if (done) {
                done();
            }

        });

        node.on('input', Input);

        function ShareNodeList() {
            NodeList.length = 0;
            Driver.controller.nodes.forEach((ZWN) => {
                let Node = {
                    id: ZWN.id,
                    name: ZWN.name !== undefined ? ZWN.name : "No Name",
                    location: ZWN.location !== undefined ? ZWN.location : "No Location",
                    isController: ZWN.isControllerNode()
                }
                NodeList.push(Node)
            });
        }

        function WireNodeEvents(Node) {

            Node.on("ready", (N) => {

                if (N.isControllerNode()) {
                    return;
                }

                if (NodesReady.indexOf(N.id) < 0) {
                    NodesReady.push(N.id);
                    node.status({ fill: "green", shape: "dot", text: "Nodes : " + NodesReady.toString() + " Are Ready." });
                    UI.status("Nodes : " + NodesReady.toString() + " Are Ready.")
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

            Node.on("interview started", (N) => {
                Send(N, "INTERVIEW_STARTED");
                node.status({ fill: "yellow", shape: "dot", text: "Node: "+N.id+" Interview Started."});
                UI.status("Node: "+N.id+" Interview Started.")
            })

            Node.on("interview failed", (N, Er) => {
                Send(N, "INTERVIEW_FAILED", Er);
                node.status({ fill: "red", shape: "dot", text: "Node: "+N.id+" Interview Failed."});
                UI.status("Node: "+N.id+" Interview Failed.")
                RestoreReadyStatus();
            })

            Node.on("interview completed", (N) => {
                Send(N, "INTERVIEW_COMPLETE");
                node.status({ fill: "green", shape: "dot", text: "Node: "+N.id+" Interview Completed."});
                UI.status("Node: "+N.id+" Interview Completed.")
                RestoreReadyStatus();
            })
        }

        async function Input(msg, send, done, internal) {

            try {

                let Node = msg.payload.node || "N/A"
                let Class = msg.payload.class;
                let Operation = msg.payload.operation;
                let Params = msg.payload.params || []

                Log("debug", "REDCTL", "IN", "[ORIG: " + (internal ? "EVENT" : "DIRECT") + "] [NDE: " + Node + "]", printParams(Class, Operation, Params))

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

                    case "Associations":
                        await Associations(msg, send);
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
                Log("error", "REDCTL", undefined, "[ERROR] [INPUT]", "Could not process payload: " + er.message)
                if (done) {
                    done(er);
                }
                else {
                    node.error(er);
                }
            }
        };

        function NodeCheck(ID, SkipReady) {

            if (Driver.controller.nodes.get(ID) === undefined) {
                let ErrorMSG = "Node " + ID + " does not exist.";
                throw new Error(ErrorMSG);
            }

            if(!SkipReady){

                if (!Driver.controller.nodes.get(ID).ready) {
                    let ErrorMSG = "Node " + ID + " is not yet ready to receive commands.";
                    throw new Error(ErrorMSG);
                }
            }
           
        }

        // Node
        async function NodeFunction(msg, send) {

            let Operation = msg.payload.operation
            let Class = msg.payload.class;
            let Node = msg.payload.node
            var Params = msg.payload.params || [];
            let forceUpdate = msg.payload.forceUpdate;

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

            Log("debug", "REDCTL", undefined, "[MAP]", "Class: " + Class + "=" + Map.MapsToClass + ", Operation: " + Operation + "=" + Func.MapsToFunc)

            let WaitForResponse = (Func.hasOwnProperty("NoEvent") && Func.NoEvent);
            if(WaitForResponse){
                Log("debug", "REDCTL", undefined, "[MAP]", "Will wait for result")
            }
            else{
                Log("debug", "REDCTL", undefined, "[MAP]", "Result will be delivered via an event")
            }
            if (WaitForResponse) {
                let Result = await ZWJSC[Func.MapsToFunc].apply(ZWJSC, Params);
                Send(ReturnNode, "VALUE_UPDATED", Result, send)
            }
            else {
                await ZWJSC[Func.MapsToFunc].apply(ZWJSC, Params);
            }

            if(forceUpdate !== undefined){
                let VID = {
                    commandClass:CommandClasses[Map.MapsToClass],
                    endpoint:EP
                }
                Object.keys(forceUpdate).forEach((VIDK) =>{
                    VID[VIDK] = forceUpdate[VIDK]
                })
                Log("debug", "REDCTL", "OUT", "[FORCE-UPDATE]", printForceUpdate(Node, VID))
                await Driver.controller.nodes.get(Node).pollValue(VID) 
            }

            return;
        }

        // Driver
        async function DriverCMD(msg, send) {

            let Operation = msg.payload.operation;
            let Params = msg.payload.params || []
            let ReturnNode = { id: "N/A" };

            switch (Operation) {

                case "GetEnums":
                    Send(ReturnNode, "ENUM_LIST", Enums, send);
                    break;

                case "GetValueDB":

                    let Result = [];

                    if(Params.length < 1){
                        Driver.controller.nodes.forEach((N, NI) => {
                            Params.push(N.id)
                        });
                    }
                    Params.forEach((NID) =>{
                        let G = {
                            nodeId:NID,
                            nodeName:getNodeInfoForPayload(NID,'name'),
                            nodeLocation:getNodeInfoForPayload(NID,'location'),
                            values:[]
                        }
                        const VIDs = Driver.controller.nodes.get(NID).getDefinedValueIDs();
                        VIDs.forEach((VID) =>{
                            let V = Driver.controller.nodes.get(NID).getValue(VID);
                            let VI = {
                                currentValue:V,
                                valueId:VID
                            }
                            G.values.push(VI)
                        })
                        Result.push(G);
                    })
                    Send(ReturnNode, "VALUE_DB", Result, send);
                    break;
            }
        }

        // Unmanaged
        async function Unmanaged(msg, send) {

            let Operation = msg.payload.operation
            let Node = msg.payload.node;
            let Params = msg.payload.params || [];

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

                case "PollValue":
                    await Driver.controller.nodes.get(Node).pollValue(Params[0]);
                    break;

            }

            return;
        }

        // Controller
        async function Controller(msg, send) {

            let Operation = msg.payload.operation
            let Params = msg.payload.params || [];

            let ReturnController = { id: "Controller" };
            let ReturnNode = { id: "" };

            let SupportsNN = false;

            switch (Operation) {

                case "GetRFRegion":
                    let RFR = await Driver.controller.getRFRegion();
                    Send(ReturnController, "CURRENT_RF_REGION", Enums.RFRegion[RFR], send);
                    break;

                case "SetRFRegion":
                    await Driver.controller.setRFRegion(Enums.RFRegion[Params[0]]);
                    Send(ReturnController, "RF_REGION_SET", Params[0], send);
                    break;

                case "ToggleRF":
                    await Driver.controller.toggleRF(Params[0]);
                    Send(ReturnController, "RF_STATUS", Params[0], send);
                    break;

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
                            supportsBeaming: N.supportsBeaming,
                            keepAwake: N.keepAwake
                        })
                    });
                    Send(ReturnController, "NODE_LIST", Nodes, send);
                    break;

                case "KeepNodeAwake":
                    NodeCheck(Params[0])
                    ReturnNode.id = Params[0]
                    Driver.controller.nodes.get(Params[0]).keepAwake = Params[1]
                    Send(ReturnNode, "NODE_KEEP_AWAKE", Params[1], send)
                    break;

                case "GetNodeNeighbors":
                    NodeCheck(Params[0])
                    let NIDs = await Driver.controller.getNodeNeighbors(Params[0]);
                    ReturnNode.id = Params[0]
                    Send(ReturnNode, "NODE_NEIGHBORS", NIDs, send);
                    break;

                case "SetNodeName":
                    NodeCheck(Params[0])
                    Driver.controller.nodes.get(Params[0]).name = Params[1]
                    SupportsNN = Driver.controller.nodes.get(Params[0]).supportsCC(CommandClasses["Node Naming and Location"])
                    if(SupportsNN){
                        await Driver.controller.nodes.get(Params[0]).commandClasses["Node Naming and Location"].setName(Params[1]);
                    }
                    ReturnNode.id = Params[0]
                    Send(ReturnNode, "NODE_NAME_SET", Params[1], send)
                    ShareNodeList();
                    break

                case "SetNodeLocation":
                    NodeCheck(Params[0])
                    Driver.controller.nodes.get(Params[0]).location = Params[1]
                    SupportsNN = Driver.controller.nodes.get(Params[0]).supportsCC(CommandClasses["Node Naming and Location"])
                    if(SupportsNN){
                        await Driver.controller.nodes.get(Params[0]).commandClasses["Node Naming and Location"].setLocation(Params[1]);
                    }
                    ReturnNode.id = Params[0]
                    Send(ReturnNode, "NODE_LOCATION_SET", Params[1], send)
                    break

                case "InterviewNode":
                    Params[0] = +Params[0]
                    NodeCheck(Params[0], true);
                    let Stage = Enums.InterviewStage[Driver.controller.nodes.get(Params[0]).interviewStage];
                    if (Stage !== "Complete") {
                        let ErrorMSG = "Node " + Params[0] + " is already being interviewed. Current Interview Stage : " + Stage + "";
                        throw new Error(ErrorMSG);
                    }
                    else {
                        await Driver.controller.nodes.get(Params[0]).refreshInfo();
                    }
                    break;

                case "HardReset":
                    await Driver.hardReset();
                    Send(ReturnController, "CONTROLLER_RESET_COMPLETE", undefined, send)
                    break;

                case "StartHealNetwork":
                    await Driver.controller.beginHealingNetwork();
                    Send(ReturnController, "NETWORK_HEAL_STARTED", undefined, send)
                    node.status({ fill: "yellow", shape: "dot", text: "Network Heal Started."});
                    UI.status("Network Heal Started.")
                    break;

                case "StopHealNetwork":
                    await Driver.controller.stopHealingNetwork();
                    Send(ReturnController, "NETWORK_HEAL_STOPPED", undefined, send)
                    node.status({ fill: "blue", shape: "dot", text: "Network Heal Stopped."});
                    UI.status("Network Heal Stopped.")
                    RestoreReadyStatus();
                    break;

                case "RemoveFailedNode":
                    await Driver.controller.removeFailedNode(Params[0]);
                    break;

                case "ReplaceFailedNode":
                    if (!canDoSecure) {
                        await Driver.controller.replaceFailedNode(Params[0],true);
                    }
                    else if (Params.length > 1) {
                        await Driver.controller.replaceFailedNode(Params[0],Params[1]);
                    }
                    else {
                        await Driver.controller.replaceFailedNode(Params[0],false);
                    }
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

                    let ZWaveMessage = new ZWaveJS.Message(Driver, {
                        type: ZWaveJS.MessageType.Request,
                        functionType: Params[0],
                        payload: Params[1]
                    })


                    let MessageSettings = {
                        priority: ZWaveJS.MessagePriority.Controller,
                        supportCheck: false
                    }

                    await Driver.sendMessage(ZWaveMessage, MessageSettings)
                    break;

             
            }

            return;
        }

      

        // Association
        async function Associations(msg, send)
        {
            let Operation = msg.payload.operation
            let Params = msg.payload.params || [];

            let ReturnNode = { id: "" };
            switch(Operation)
            {
                case "GetAssociationGroups":
                    NodeCheck(Params[0].nodeId);
                    var ResultData = Driver.controller.getAssociationGroups(Params[0])
                    var PL = []
                    ResultData.forEach((FV,FK) =>{
                        let A = {
                            GroupID:FK,
                            AssociationGroupInfo:FV
                        }
                        PL.push(A);
                    })

                    ReturnNode.id = Params[0].nodeId
                    Send(ReturnNode,"ASSOCIATION_GROUPS",{SourceAddress:Params[0],Groups:PL},send)
                    break;

                case "GetAllAssociationGroups":
                    NodeCheck(Params[0]);
                    var ResultData = Driver.controller.getAllAssociationGroups(Params[0])
                    var PL = [];
                    ResultData.forEach((FV,FK) =>{
                        let A = {
                            Endpoint:FK,
                            Groups:[]
                        }
                        FV.forEach((SV, SK) =>{
                            let B = {
                                GroupID:SK,
                                AssociationGroupInfo:SV
                            }
                            A.Groups.push(B)
                        })
                        PL.push(A);
                    })

                    ReturnNode.id = Params[0]
                    Send(ReturnNode,"ALL_ASSOCIATION_GROUPS",PL,send)
                    break;

                case "GetAssociations":
                    NodeCheck(Params[0].nodeId);
                    var ResultData = Driver.controller.getAssociations(Params[0])
                    var PL = []
                    ResultData.forEach((FV, FK) =>{
                        let A = {
                            GroupID:FK,
                            AssociationAddress:[]
                        }
                        FV.forEach((AA) =>{
                            A.AssociationAddress.push(AA);
                        });

                        PL.push(A)
                    })

                    ReturnNode.id = Params[0].nodeId
                    Send(ReturnNode,"ASSOCIATIONS",{SourceAddress:Params[0],Associations:PL},send)
                    break;

                case "GetAllAssociations":
                    NodeCheck(Params[0]);
                    var ResultData = Driver.controller.getAllAssociations(Params[0]);
                    var PL = []
                    ResultData.forEach((FV, FK) =>{
                        let A = {
                            AssociationAddress:FK,
                            Associations:[]
                        }
                        FV.forEach((SV, SK) => {
                            let B = {
                                GroupID: SK,
                                AssociationAddress: SV
                            }
                            A.Associations.push(B)
                        });
                        PL.push(A)
                    })

                    ReturnNode.id = Params[0]
                    Send(ReturnNode,"ALL_ASSOCIATIONS",PL,send)
                    break;

                case "AddAssociations":
                    NodeCheck(Params[0].nodeId);
                    Params[2].forEach((A) =>{
                        if(!Driver.controller.isAssociationAllowed(Params[0], Params[1], A)){
                            let ErrorMSG = "Association: Source "+JSON.stringify(Params[0]); +", Group "+Params[1]+", Destination "+SON.stringify(A)+" is not allowed."
                            throw new Error(ErrorMSG);
                        }
                    })
                    await Driver.controller.addAssociations(Params[0], Params[1], Params[2])
                    ReturnNode.id = Params[0].nodeId
                    Send(ReturnNode,"ASSOCIATIONS_ADDED",undefined,send)
                    break;
            
                case "RemoveAssociations":
                    NodeCheck(Params[0].nodeId);
                    await Driver.controller.removeAssociations(Params[0], Params[1], Params[2])
                    ReturnNode.id = Params[0].nodeId
                    Send(ReturnNode,"ASSOCIATIONS_REMOVED",undefined,send)
                    break;

                case "RemoveNodeFromAllAssociations":
                    NodeCheck(Params[0]);
                    await Driver.controller.removeNodeFromAllAssociations(Params[0])
                    ReturnNode.id = Params[0]
                    Send(ReturnNode,"ALL_ASSOCIATIONS_REMOVED",undefined,send)
                    break;
            }

            return;
        }

        function printParams(Class, Operation, params) {

            let Lines = [];
            Lines.push("[CLS: " + Class + "] [OP: " + Operation + "]")

            if (params.length > 0) {

                Lines.push("└─[params]")
                let i = 0;
                params.forEach((P) => {

                    if (typeof P === 'object') {
                        Lines.push("    " + (i + ": ") + JSON.stringify(P));
                    }
                    else {
                        Lines.push("    " + (i + ": ") + P);
                    }
                    i++
                })
            }

            return Lines
        }

        function printObject(Event, Value) {

            let Lines = [];
            Lines.push("[EVT: " + Event + "]")

            if (Value !== undefined) {

                Lines.push("└─[object]")

                let OBKeys = Object.keys(Value);
                OBKeys.forEach((K) => {
                    Lines.push("    " + (K + ": ") + Value[K]);
                })
            }
            return Lines;
        }

        function printForceUpdate(NID, Value) {

            let Lines = [];
            Lines.push("[NDE: " + NID + "]")

            if (Value !== undefined) {

                Lines.push("└─[ValueID]")

                let OBKeys = Object.keys(Value);
                OBKeys.forEach((K) => {
                    Lines.push("    " + (K + ": ") + Value[K]);
                })
            }
            return Lines;
        }


        function getNodeInfoForPayload(NodeID, Property){
            let Prop = Driver.controller.nodes.get(parseInt(NodeID))[Property];
            return Prop
        }

        function Send(Node, Subject, Value, send) {

            let PL = {"node": Node.id}
            if(Node.id !== 'N/A' && Node.id !== 'Controller'){

                let N = getNodeInfoForPayload(Node.id,'name');
                if(N !== undefined){
                    PL.nodeName = N;
                }

                let L = getNodeInfoForPayload(Node.id,'location')
                if(L !== undefined){
                    PL.nodeLocation = L
                }
            }
            PL.event = Subject,
            PL.timestamp = new Date().toJSON()
            if (Value !== undefined) {
                PL.object = Value;
            }

            Log("debug", "REDCTL", "OUT", "[NDE: " + Node.id + "]", printObject(Subject, Value))

            if (send) {
                send({ "payload": PL })
            }
            else {
                node.send({ "payload": PL });
            }

            let AllowedSubjectsForDNs = [
               "VALUE_NOTIFICATION",
               "NOTIFICATION",
               "VALUE_UPDATED",
               "SLEEP",
               "WAKE_UP"
            ]

            if (AllowedSubjectsForDNs.includes(Subject)) {
                RED.events.emit("zwjs:node:event:" + Node.id, { "payload": PL })
            }
        }

        // Duration Fix
        function ProcessDurationClass(Class, Operation, Params) {
            if (Params.length > 1) {
                if (typeof Params[1] === "object") {
                    let Keys = Object.keys(Params[1]);
                    if (Keys.length === 1 && Keys[0] === "Duration") {
                        let D = new Duration(Params[1].Duration.value, Params[1].Duration.unit)
                        Params[1] = D;
                    }
                }
            }
            return Params;
        }

        // Meter Fix
        function ParseMeterOptions(Class, Operation, Params) {
            if (typeof Params[0] === "object") {
                Params[0].rateType = Enums.RateType[Params[0].rateType];
            }
            return Params;

        }

        Log("info", "REDCTL", undefined, undefined, "Starting 'Driver'")
        Driver.start()
            .catch((e) => {
                Log("error", "REDCTL", undefined, "[ERROR] [START]", "'Driver' threw: " + e.message)
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