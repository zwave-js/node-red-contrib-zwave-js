module.exports = function (RED) {
    const SP = require('serialport');
    const Path = require('path');
    const ModulePackage = require('../package.json');
    const ZWaveJS = require('zwave-js');
    const {
        createDefaultTransportFormat,
        CommandClasses,
        ZWaveErrorCodes
    } = require('@zwave-js/core');
    const ZWaveJSPackage = require('zwave-js/package.json');
    const Winston = require('winston');

    const UI = require('./ui/server.js');
    UI.init(RED);
    const NodeList = {};

    function Init(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        const NodesReady = [];
        let AllNodesReady = false;
        let Driver;
        let Logger;
        let FileTransport;

        const MaxDriverAttempts = 3;
        let DriverAttempts = 0;
        const RetryTime = 5000;
        let DriverOptions = {};

        const NodeStats = {};
        let ControllerStats;

        // Log function
        const Log = function (level, label, direction, tag1, msg, tag2) {
            if (Logger !== undefined) {
                const logEntry = {
                    direction: '  ',
                    message: msg,
                    level: level,
                    label: label,
                    timestamp: new Date().toJSON(),
                    multiline: Array.isArray(msg)
                };
                if (direction !== undefined) {
                    logEntry.direction = direction === 'IN' ? '« ' : '» ';
                }
                if (tag1 !== undefined) {
                    logEntry.primaryTags = tag1;
                }
                if (tag2 !== undefined) {
                    logEntry.secondaryTags = tag2;
                }
                Logger.log(logEntry);
            }
        };

        let RestoreReadyTimer;
        function RestoreReadyStatus() {
            RestoreReadyTimer = setTimeout(() => {
                if (AllNodesReady) {
                    node.status({
                        fill: 'green',
                        shape: 'dot',
                        text: 'All Nodes Ready!'
                    });
                    UI.status('All Nodes Ready!');
                } else {
                    node.status({
                        fill: 'yellow',
                        shape: 'dot',
                        text: 'Nodes : ' + NodesReady.toString() + ' Are Ready.'
                    });
                    UI.status('Nodes : ' + NodesReady.toString() + ' Are Ready.');
                }
            }, 5000);
        }

        // Create Logger (if enabled)
        if (config.logLevel !== 'none') {
            Logger = Winston.createLogger();

            const FileTransportOptions = {
                filename: Path.join(RED.settings.userDir, 'zwave-js-log.txt'),
                format: createDefaultTransportFormat(false, false),
                level: config.logLevel
            };
            if (config.logFile !== undefined && config.logFile.length > 0) {
                FileTransportOptions.filename = config.logFile;
            }

            FileTransport = new Winston.transports.File(FileTransportOptions);
            Logger.add(FileTransport);
        }

        node.status({
            fill: 'red',
            shape: 'dot',
            text: 'Starting Z-Wave Driver...'
        });
        UI.status('Starting Z-Wave Driver...');

        RED.events.on('zwjs:node:command', processMessageEvent);
        async function processMessageEvent(MSG) {
            await Input(MSG, undefined, undefined, true);
        }

        DriverOptions = {};

        // Logging
        DriverOptions.logConfig = {};
        if (Logger !== undefined) {
            DriverOptions.logConfig.enabled = true;

            if (
                config.logNodeFilter !== undefined &&
                config.logNodeFilter.length > 0
            ) {
                const Nodes = config.logNodeFilter.split(',');
                const NodesArray = [];
                Nodes.forEach((N) => {
                    NodesArray.push(parseInt(N));
                });
                DriverOptions.logConfig.nodeFilter = NodesArray;
            }
            DriverOptions.logConfig.transports = [FileTransport];
        } else {
            DriverOptions.logConfig.enabled = false;
        }

        DriverOptions.storage = {};

        // Cache Dir
        Log(
            'debug',
            'NDERED',
            undefined,
            '[options] [storage.cacheDir]',
            Path.join(RED.settings.userDir, 'zwave-js-cache')
        );
        DriverOptions.storage.cacheDir = Path.join(
            RED.settings.userDir,
            'zwave-js-cache'
        );

        // Custom  Config Path
        if (
            config.customConfigPath !== undefined &&
            config.customConfigPath.length > 0
        ) {
            Log(
                'debug',
                'NDERED',
                undefined,
                '[options] [storage.deviceConfigPriorityDir]',
                config.customConfigPath
            );
            DriverOptions.storage.deviceConfigPriorityDir = config.customConfigPath;
        }

        // Disk throttle
        if (
            config.valueCacheDiskThrottle !== undefined &&
            config.valueCacheDiskThrottle.length > 0
        ) {
            Log(
                'debug',
                'NDERED',
                undefined,
                '[options] [storage.throttle]',
                config.valueCacheDiskThrottle
            );
            DriverOptions.storage.throttle = config.valueCacheDiskThrottle;
        }

        // Timeout
        DriverOptions.timeouts = {};
        if (config.ackTimeout !== undefined && config.ackTimeout.length > 0) {
            Log(
                'debug',
                'NDERED',
                undefined,
                '[options] [timeouts.ack]',
                config.ackTimeout
            );
            DriverOptions.timeouts.ack = parseInt(config.ackTimeout);
        }
        if (
            config.controllerTimeout !== undefined &&
            config.controllerTimeout.length > 0
        ) {
            Log(
                'debug',
                'NDERED',
                undefined,
                '[options] [timeouts.response]',
                config.controllerTimeout
            );
            DriverOptions.timeouts.response = parseInt(config.controllerTimeout);
        }
        if (
            config.sendResponseTimeout !== undefined &&
            config.sendResponseTimeout.length > 0
        ) {
            Log(
                'debug',
                'NDERED',
                undefined,
                '[options] [timeouts.report]',
                config.sendResponseTimeout
            );
            DriverOptions.timeouts.report = parseInt(config.sendResponseTimeout);
        }

        DriverOptions.securityKeys = {};

        const GetKey = (Property, ZWAVEJSName) => {
            if (config[Property] !== undefined && config[Property].length > 0) {
                if (
                    config[Property].startsWith('[') &&
                    config[Property].endsWith(']')
                ) {
                    const RemoveBrackets = config[Property].replace('[', '').replace(
                        ']',
                        ''
                    );
                    const _Array = RemoveBrackets.split(',');
                    Log(
                        'debug',
                        'NDERED',
                        undefined,
                        '[options] [securityKeys.' + ZWAVEJSName + ']',
                        'Provided as array',
                        '[' + _Array.length + ' bytes]'
                    );

                    const _Buffer = [];
                    for (let i = 0; i < _Array.length; i++) {
                        _Buffer.push(parseInt(_Array[i].trim()));
                    }
                    DriverOptions.securityKeys[ZWAVEJSName] = Buffer.from(_Buffer);
                } else {
                    Log(
                        'debug',
                        'NDERED',
                        undefined,
                        '[options] [securityKeys.' + ZWAVEJSName + ']',
                        'Provided as string',
                        '[' + config[Property].length + ' characters]'
                    );
                    DriverOptions.securityKeys[ZWAVEJSName] = Buffer.from(
                        config[Property]
                    );
                }
            }
        };

        GetKey('encryptionKey', 'S0_Legacy');
        GetKey('encryptionKeyS2U', 'S2_Unauthenticated');
        GetKey('encryptionKeyS2A', 'S2_Authenticated');
        GetKey('encryptionKeyS2AC', 'S2_AccessControl');

        function ShareNodeList() {
            for (const Location in NodeList) delete NodeList[Location];

            NodeList['No Location'] = [];
            Driver.controller.nodes.forEach((ZWN) => {
                if (ZWN.isControllerNode()) {
                    return;
                }
                const Node = {
                    id: ZWN.id,
                    name: ZWN.name !== undefined ? ZWN.name : 'No Name',
                    location: ZWN.location !== undefined ? ZWN.location : 'No Location'
                };
                if (!NodeList.hasOwnProperty(Node.location)) {
                    NodeList[Node.location] = [];
                }
                NodeList[Node.location].push(Node);
            });
        }

        function NodeCheck(ID, SkipReady) {
            if (Driver.controller.nodes.get(ID) === undefined) {
                const ErrorMSG = 'Node ' + ID + ' does not exist.';
                throw new Error(ErrorMSG);
            }

            if (!SkipReady) {
                if (!Driver.controller.nodes.get(ID).ready) {
                    const ErrorMSG =
                        'Node ' + ID + ' is not yet ready to receive commands.';
                    throw new Error(ErrorMSG);
                }
            }
        }

        function ThrowVirtualNodeLimit() {
            throw new Error(
                'Multicast only supports ValueAPI:setValue and CCAPI set type commands.'
            );
        }

        node.on('close', (removed, done) => {
            const Type = removed ? 'DELETE' : 'RESTART';
            Log(
                'info',
                'NDERED',
                undefined,
                '[SHUTDOWN] [' + Type + ']',
                'Cleaning up...'
            );
            UI.unregister();
            Driver.destroy();
            RED.events.off('zwjs:node:command', processMessageEvent);
            if (done) {
                done();
            }
        });

        node.on('input', Input);

        async function Input(msg, send, done, internal) {
            let Type = 'CONTROLLER';
            if (internal !== undefined && internal) {
                Type = 'EVENT';
            }

            Log('debug', 'NDERED', 'IN', '[' + Type + ']', 'Payload received.');

            try {
                const Mode = msg.payload.mode;
                switch (Mode) {
                    case 'IEAPI':
                        await IEAPI(msg);
                        break;
                    case 'CCAPI':
                        await CCAPI(msg, send);
                        break;
                    case 'ValueAPI':
                        await ValueAPI(msg, send);
                        break;
                    case 'DriverAPI':
                        await DriverAPI(msg, send);
                        break;
                    case 'ControllerAPI':
                        await ControllerAPI(msg, send);
                        break;
                    case 'AssociationsAPI':
                        await AssociationsAPI(msg, send);
                        break;
                }

                if (done) {
                    done();
                }
            } catch (er) {
                Log('error', 'NDERED', undefined, '[ERROR] [INPUT]', er.message);

                if (done) {
                    done(er);
                } else {
                    node.error(er);
                }
            }
        }

        let _GrantResolve;
        let _DSKResolve;
        async function IEAPI(msg) {
            const Method = msg.payload.method;
            const Params = msg.payload.params || [];

            const Callbacks = {
                grantSecurityClasses: GrantSecurityClasses,
                validateDSKAndEnterPIN: ValidateDSK,
                abort: Abort
            };

            switch (Method) {
                case 'beginInclusion':
                    Params[0].userCallbacks = Callbacks;
                    await Driver.controller.beginInclusion(Params[0]);
                    break;

                case 'beginExclusion':
                    await Driver.controller.beginExclusion();
                    break;

                case 'grantClasses':
                    Grant(Params[0]);
                    break;

                case 'verifyDSK':
                    VerifyDSK(Params[0]);
                    break;

                case 'replaceNode':
                    Params[1].userCallbacks = Callbacks;
                    await Driver.controller.replaceFailedNode(Params[0], Params[1]);
                    break;

                case 'stop':
                    Driver.controller.stopInclusion();
                    Driver.controller.stopExclusion();
                    RestoreReadyStatus();
                    break;
            }
            return;
        }

        function GrantSecurityClasses(RequestedClasses) {
            UI.sendEvent('node-inclusion-step', 'grant security', {
                classes: RequestedClasses
            });
            return new Promise((res) => {
                _GrantResolve = res;
            });
        }

        function Grant(Classes) {
            _GrantResolve({
                securityClasses: Classes,
                clientSideAuth: false
            });
        }

        function ValidateDSK(DSK) {
            UI.sendEvent('node-inclusion-step', 'verify dsk', { dsk: DSK });
            return new Promise((res) => {
                _DSKResolve = res;
            });
        }

        function VerifyDSK(Pin) {
            _DSKResolve(Pin);
        }

        function Abort() {
            UI.sendEvent('node-inclusion-step', 'aborted');
        }

        async function ControllerAPI(msg, send) {
            const Method = msg.payload.method;
            const Params = msg.payload.params || [];
            const ReturnNode = { id: '' };

            Log(
                'debug',
                'NDERED',
                'IN',
                undefined,
                printParams('ControllerAPI', undefined, Method, Params)
            );

            let SupportsNN = false;

            switch (Method) {
                case 'abortFirmwareUpdate':
                    NodeCheck(Params[0]);
                    ReturnNode.id = Params[0];
                    await Driver.controller.nodes.get(Params[0]).abortFirmwareUpdate();
                    Send(ReturnNode, 'FIRMWARE_UPDATE_ABORTED', undefined, send);
                    break;

                case 'beginFirmwareUpdate':
                    NodeCheck(Params[0]);
                    ReturnNode.id = Params[0];
                    const Format = ZWaveJS.guessFirmwareFileFormat(Params[2], Params[3]);
                    const Firmware = ZWaveJS.extractFirmware(Params[3], Format);
                    await Driver.controller.nodes
                        .get(Params[0])
                        .beginFirmwareUpdate(Firmware.data, Params[1]);
                    Send(ReturnNode, 'FIRMWARE_UPDATE_STARTED', Params[1], send);
                    break;

                case 'getRFRegion':
                    const RFR = await Driver.controller.getRFRegion();
                    Send(undefined, 'CURRENT_RF_REGION', ZWaveJS.RFRegion[RFR], send);
                    break;

                case 'setRFRegion':
                    await Driver.controller.setRFRegion(ZWaveJS.RFRegion[Params[0]]);
                    Send(undefined, 'RF_REGION_SET', Params[0], send);
                    break;

                case 'toggleRF':
                    await Driver.controller.toggleRF(Params[0]);
                    Send(undefined, 'RF_STATUS', Params[0], send);
                    break;

                case 'getNodes':
                    const Nodes = [];
                    Driver.controller.nodes.forEach((N) => {
                        Nodes.push({
                            nodeId: N.id,
                            name: N.name,
                            location: N.location,
                            status: ZWaveJS.NodeStatus[N.status],
                            ready: N.ready,
                            interviewStage: ZWaveJS.InterviewStage[N.interviewStage],
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
                            highestSecurityClass: N.getHighestSecurityClass(),
                            protocolVersion: ZWaveJS.ProtocolVersion[N.protocolVersion],
                            manufacturerId: N.manufacturerId,
                            productId: N.productId,
                            productType: N.productType,
                            firmwareVersion: N.firmwareVersion,
                            deviceConfig: N.deviceConfig,
                            isControllerNode: N.isControllerNode(),
                            supportsBeaming: N.supportsBeaming,
                            keepAwake: N.keepAwake
                        });
                    });
                    Send(undefined, 'NODE_LIST', Nodes, send);
                    break;

                case 'keepNodeAwake':
                    NodeCheck(Params[0]);
                    ReturnNode.id = Params[0];
                    Driver.controller.nodes.get(Params[0]).keepAwake = Params[1];
                    Send(ReturnNode, 'NODE_KEEP_AWAKE', Params[1], send);
                    break;

                case 'getNodeNeighbors':
                    NodeCheck(Params[0]);
                    const NIDs = await Driver.controller.getNodeNeighbors(Params[0]);
                    ReturnNode.id = Params[0];
                    Send(ReturnNode, 'NODE_NEIGHBORS', NIDs, send);
                    break;

                case 'setNodeName':
                    NodeCheck(Params[0]);
                    Driver.controller.nodes.get(Params[0]).name = Params[1];
                    SupportsNN = Driver.controller.nodes
                        .get(Params[0])
                        .supportsCC(CommandClasses['Node Naming and Location']);
                    if (SupportsNN) {
                        await Driver.controller.nodes
                            .get(Params[0])
                            .commandClasses['Node Naming and Location'].setName(Params[1]);
                    }
                    ReturnNode.id = Params[0];
                    Send(ReturnNode, 'NODE_NAME_SET', Params[1], send);
                    ShareNodeList();
                    break;

                case 'setNodeLocation':
                    NodeCheck(Params[0]);
                    Driver.controller.nodes.get(Params[0]).location = Params[1];
                    SupportsNN = Driver.controller.nodes
                        .get(Params[0])
                        .supportsCC(CommandClasses['Node Naming and Location']);
                    if (SupportsNN) {
                        await Driver.controller.nodes
                            .get(Params[0])
                            .commandClasses['Node Naming and Location'].setLocation(
                                Params[1]
                            );
                    }
                    ReturnNode.id = Params[0];
                    Send(ReturnNode, 'NODE_LOCATION_SET', Params[1], send);
                    ShareNodeList();
                    break;

                case 'refreshInfo':
                    NodeCheck(Params[0], true);
                    const Stage =
                        ZWaveJS.InterviewStage[
                        Driver.controller.nodes.get(Params[0]).interviewStage
                        ];
                    if (Stage !== 'Complete') {
                        const ErrorMSG =
                            'Node ' +
                            Params[0] +
                            ' is already being interviewed. Current Interview Stage : ' +
                            Stage +
                            '';
                        throw new Error(ErrorMSG);
                    } else {
                        await Driver.controller.nodes.get(Params[0]).refreshInfo();
                    }
                    break;

                case 'hardReset':
                    await Driver.hardReset();
                    Send(undefined, 'CONTROLLER_RESET_COMPLETE', undefined, send);
                    break;

                case 'healNode':
                    NodeCheck(Params[0]);
                    ReturnNode.id = Params[0];
                    Send(ReturnNode, 'NODE_HEAL_STARTED', undefined, send);
                    node.status({
                        fill: 'yellow',
                        shape: 'dot',
                        text: 'Node Heal Started: ' + Params[0]
                    });
                    UI.status('Node Heal Started: ' + Params[0]);
                    const HealResponse = await Driver.controller.healNode(Params[0]);
                    if (HealResponse) {
                        node.status({
                            fill: 'green',
                            shape: 'dot',
                            text: 'Node Heal Successful: ' + Params[0]
                        });
                        UI.status('Node Heal Successful: ' + Params[0]);
                    } else {
                        node.status({
                            fill: 'red',
                            shape: 'dot',
                            text: 'Node Heal Unsuccessful: ' + Params[0]
                        });
                        UI.status('Node Heal Unsuccessful: ' + Params[0]);
                    }
                    Send(
                        ReturnNode,
                        'NODE_HEAL_FINISHED',
                        { success: HealResponse },
                        send
                    );
                    RestoreReadyStatus();
                    break;

                case 'beginHealingNetwork':
                    await Driver.controller.beginHealingNetwork();
                    Send(undefined, 'NETWORK_HEAL_STARTED', undefined, send);
                    node.status({
                        fill: 'yellow',
                        shape: 'dot',
                        text: 'Network Heal Started.'
                    });
                    UI.status('Network Heal Started.');
                    break;

                case 'stopHealingNetwork':
                    await Driver.controller.stopHealingNetwork();
                    Send(undefined, 'NETWORK_HEAL_STOPPED', undefined, send);
                    node.status({
                        fill: 'blue',
                        shape: 'dot',
                        text: 'Network Heal Stopped.'
                    });
                    UI.status('Network Heal Stopped.');
                    RestoreReadyStatus();
                    break;

                case 'removeFailedNode':
                    await Driver.controller.removeFailedNode(Params[0]);
                    break;

                case 'proprietaryFunction':
                    const ZWaveMessage = new ZWaveJS.Message(Driver, {
                        type: ZWaveJS.MessageType.Request,
                        functionType: Params[0],
                        payload: Params[1]
                    });

                    const MessageSettings = {
                        priority: ZWaveJS.MessagePriority.Controller,
                        supportCheck: false
                    };

                    await Driver.sendMessage(ZWaveMessage, MessageSettings);
                    break;
            }

            return;
        }

        async function ValueAPI(msg, send) {
            const Method = msg.payload.method;
            const Params = msg.payload.params || [];
            const Node = msg.payload.node;
            const Multicast = Array.isArray(Node);

            let ZWaveNode;
            if (Multicast) {
                ZWaveNode = Driver.controller.getMulticastGroup(Node);
            } else {
                NodeCheck(Node);
                ZWaveNode = Driver.controller.nodes.get(Node);
            }

            Log(
                'debug',
                'NDERED',
                'IN',
                '[Node: ' + ZWaveNode.id + ']',
                printParams('ValueAPI', undefined, Method, Params)
            );

            const ReturnNode = { id: ZWaveNode.id };

            switch (Method) {
                case 'getDefinedValueIDs':
                    if (Multicast) ThrowVirtualNodeLimit();
                    const VIDs = ZWaveNode.getDefinedValueIDs();
                    Send(ReturnNode, 'VALUE_ID_LIST', VIDs, send);
                    break;

                case 'getValueMetadata':
                    if (Multicast) ThrowVirtualNodeLimit();
                    const M = ZWaveNode.getValueMetadata(Params[0]);
                    const ReturnObjectM = {
                        response: M,
                        valueId: Params[0]
                    };
                    Send(ReturnNode, 'GET_VALUE_METADATA_RESPONSE', ReturnObjectM, send);
                    break;

                case 'getValue':
                    if (Multicast) ThrowVirtualNodeLimit();
                    const V = ZWaveNode.getValue(Params[0]);
                    const ReturnObject = {
                        response: V,
                        valueId: Params[0]
                    };
                    Send(ReturnNode, 'GET_VALUE_RESPONSE', ReturnObject, send);
                    break;

                case 'setValue':
                    if (Params.length > 2) {
                        await ZWaveNode.setValue(Params[0], Params[1], Params[2]);
                    } else {
                        await ZWaveNode.setValue(Params[0], Params[1]);
                    }
                    break;

                case 'pollValue':
                    if (Multicast) ThrowVirtualNodeLimit();
                    await ZWaveNode.pollValue(Params[0]);
                    break;
            }

            return;
        }

        async function CCAPI(msg, send) {
            const CC = msg.payload.cc;
            const Method = msg.payload.method;
            const Params = msg.payload.params || [];
            const Node = msg.payload.node;
            const Endpoint = msg.payload.endpoint || 0;
            const EnumSelection = msg.payload.enums;
            const ForceUpdate = msg.payload.forceUpdate;
            const Multicast = Array.isArray(Node);
            let IsEventResponse = true;

            let ZWaveNode;
            if (Multicast) {
                ZWaveNode = Driver.controller.getMulticastGroup(Node);
            } else {
                NodeCheck(Node);
                ZWaveNode = Driver.controller.nodes.get(Node);
            }

            Log(
                'debug',
                'NDERED',
                'IN',
                '[Node: ' + ZWaveNode.id + ']',
                printParams('CCAPI', CC, Method, Params)
            );

            if (msg.payload.responseThroughEvent !== undefined) {
                IsEventResponse = msg.payload.responseThroughEvent;
            }

            const ReturnNode = { id: ZWaveNode.id };

            if (EnumSelection !== undefined) {
                const ParamIndexs = Object.keys(EnumSelection);
                ParamIndexs.forEach((PI) => {
                    const EnumName = EnumSelection[PI];
                    const Enum = ZWaveJS[EnumName];
                    Params[PI] = Enum[Params[PI]];
                });
            }

            const Result = await ZWaveNode.getEndpoint(Endpoint).invokeCCAPI(
                CommandClasses[CC],
                Method,
                ...Params
            );
            if (!IsEventResponse && ForceUpdate === undefined) {
                Send(ReturnNode, 'VALUE_UPDATED', Result, send);
            }

            if (ForceUpdate !== undefined) {
                if (Multicast) ThrowVirtualNodeLimit();

                const ValueID = {
                    commandClass: CommandClasses[CC],
                    endpoint: Endpoint
                };
                Object.keys(ForceUpdate).forEach((VIDK) => {
                    ValueID[VIDK] = ForceUpdate[VIDK];
                });
                Log(
                    'debug',
                    'NDERED',
                    undefined,
                    '[POLL]',
                    printForceUpdate(Node, ValueID)
                );
                await ZWaveNode.pollValue(ValueID);
            }

            return;
        }

        async function DriverAPI(msg, send) {
            const Method = msg.payload.method;
            const Params = msg.payload.params || [];

            Log(
                'debug',
                'NDERED',
                'IN',
                undefined,
                printParams('DriverAPI', undefined, Method, Params)
            );

            switch (Method) {
                case 'getNodeStatistics':
                    if (Params.length < 1) {
                        Send(undefined, 'NODE_STATISTICS', NodeStats, send);
                    } else {
                        const Stats = {};
                        Params.forEach((NID) => {
                            if (NodeStats.hasOwnProperty(NID)) {
                                Stats[NID] = NodeStats[NID];
                            }
                        });
                        Send(undefined, 'NODE_STATISTICS', Stats, send);
                    }
                    break;

                case 'getControllerStatistics':
                    if (ControllerStats === undefined) {
                        Send(
                            undefined,
                            'CONTROLER_STATISTICS',
                            'Statistics Are Pending',
                            send
                        );
                    } else {
                        Send(undefined, 'CONTROLER_STATISTICS', ControllerStats, send);
                    }
                    break;

                case 'getValueDB':
                    const Result = [];
                    if (Params.length < 1) {
                        Driver.controller.nodes.forEach((N) => {
                            Params.push(N.id);
                        });
                    }
                    Params.forEach((NID) => {
                        const G = {
                            nodeId: NID,
                            nodeName: getNodeInfoForPayload(NID, 'name'),
                            nodeLocation: getNodeInfoForPayload(NID, 'location'),
                            values: []
                        };
                        const VIDs = Driver.controller.nodes.get(NID).getDefinedValueIDs();
                        VIDs.forEach((VID) => {
                            const V = Driver.controller.nodes.get(NID).getValue(VID);
                            const VI = {
                                currentValue: V,
                                valueId: VID
                            };
                            G.values.push(VI);
                        });
                        Result.push(G);
                    });
                    Send(undefined, 'VALUE_DB', Result, send);
                    break;
            }

            return;
        }

        async function AssociationsAPI(msg, send) {
            const Method = msg.payload.method;
            const Params = msg.payload.params || [];

            Log(
                'debug',
                'NDERED',
                'IN',
                undefined,
                printParams('AssociationsAPI', undefined, Method, Params)
            );

            const ReturnNode = { id: '' };
            let ResultData;
            let PL;
            switch (Method) {
                case 'getAssociationGroups':
                    NodeCheck(Params[0].nodeId);
                    ResultData = Driver.controller.getAssociationGroups(Params[0]);
                    PL = [];
                    ResultData.forEach((FV, FK) => {
                        const A = {
                            GroupID: FK,
                            AssociationGroupInfo: FV
                        };
                        PL.push(A);
                    });

                    ReturnNode.id = Params[0].nodeId;
                    Send(
                        ReturnNode,
                        'ASSOCIATION_GROUPS',
                        { SourceAddress: Params[0], Groups: PL },
                        send
                    );
                    break;

                case 'getAllAssociationGroups':
                    NodeCheck(Params[0]);
                    ResultData = Driver.controller.getAllAssociationGroups(Params[0]);
                    PL = [];
                    ResultData.forEach((FV, FK) => {
                        const A = {
                            Endpoint: FK,
                            Groups: []
                        };
                        FV.forEach((SV, SK) => {
                            const B = {
                                GroupID: SK,
                                AssociationGroupInfo: SV
                            };
                            A.Groups.push(B);
                        });
                        PL.push(A);
                    });

                    ReturnNode.id = Params[0];
                    Send(ReturnNode, 'ALL_ASSOCIATION_GROUPS', PL, send);
                    break;

                case 'getAssociations':
                    NodeCheck(Params[0].nodeId);
                    ResultData = Driver.controller.getAssociations(Params[0]);
                    PL = [];
                    ResultData.forEach((FV, FK) => {
                        const A = {
                            GroupID: FK,
                            AssociationAddress: []
                        };
                        FV.forEach((AA) => {
                            A.AssociationAddress.push(AA);
                        });

                        PL.push(A);
                    });

                    ReturnNode.id = Params[0].nodeId;
                    Send(
                        ReturnNode,
                        'ASSOCIATIONS',
                        { SourceAddress: Params[0], Associations: PL },
                        send
                    );
                    break;

                case 'getAllAssociations':
                    NodeCheck(Params[0]);
                    ResultData = Driver.controller.getAllAssociations(Params[0]);
                    PL = [];
                    ResultData.forEach((FV, FK) => {
                        const A = {
                            AssociationAddress: FK,
                            Associations: []
                        };
                        FV.forEach((SV, SK) => {
                            const B = {
                                GroupID: SK,
                                AssociationAddress: SV
                            };
                            A.Associations.push(B);
                        });
                        PL.push(A);
                    });

                    ReturnNode.id = Params[0];
                    Send(ReturnNode, 'ALL_ASSOCIATIONS', PL, send);
                    break;

                case 'addAssociations':
                    NodeCheck(Params[0].nodeId);
                    Params[2].forEach((A) => {
                        if (
                            !Driver.controller.isAssociationAllowed(Params[0], Params[1], A)
                        ) {
                            const ErrorMSG =
                                'Association: Source ' + JSON.stringify(Params[0]);
                            +', Group ' +
                                Params[1] +
                                ', Destination ' +
                                JSON.stringify(A) +
                                ' is not allowed.';
                            throw new Error(ErrorMSG);
                        }
                    });
                    await Driver.controller.addAssociations(
                        Params[0],
                        Params[1],
                        Params[2]
                    );
                    ReturnNode.id = Params[0].nodeId;
                    Send(ReturnNode, 'ASSOCIATIONS_ADDED', undefined, send);
                    break;

                case 'removeAssociations':
                    NodeCheck(Params[0].nodeId);
                    await Driver.controller.removeAssociations(
                        Params[0],
                        Params[1],
                        Params[2]
                    );
                    ReturnNode.id = Params[0].nodeId;
                    Send(ReturnNode, 'ASSOCIATIONS_REMOVED', undefined, send);
                    break;

                case 'removeNodeFromAllAssociations':
                    NodeCheck(Params[0]);
                    await Driver.controller.removeNodeFromAllAssociations(Params[0]);
                    ReturnNode.id = Params[0];
                    Send(ReturnNode, 'ALL_ASSOCIATIONS_REMOVED', undefined, send);
                    break;
            }

            return;
        }

        function printParams(Mode, CC, Method, Params) {
            const Lines = [];
            if (CC !== undefined) {
                Lines.push(
                    '[API: ' + Mode + '] [CC: ' + CC + '] [Method: ' + Method + ']'
                );
            } else {
                Lines.push('[API: ' + Mode + '] [Method: ' + Method + ']');
            }

            if (Params.length > 0) {
                Lines.push('└─[params]');
                let i = 0;
                Params.forEach((P) => {
                    if (typeof P === 'object') {
                        Lines.push('    ' + (i + ': ') + JSON.stringify(P));
                    } else {
                        Lines.push('    ' + (i + ': ') + P);
                    }
                    i++;
                });
            }

            return Lines;
        }

        function printForceUpdate(NID, Value) {
            const Lines = [];
            Lines.push('[Node: ' + NID + ']');

            if (Value !== undefined) {
                Lines.push('└─[ValueID]');

                const OBKeys = Object.keys(Value);
                OBKeys.forEach((K) => {
                    Lines.push('    ' + (K + ': ') + Value[K]);
                });
            }
            return Lines;
        }

        function getNodeInfoForPayload(NodeID, Property) {
            try{
                const Prop = Driver.controller.nodes.get(parseInt(NodeID))[Property];
                return Prop;
            }
            catch(err){
                return undefined;
            }
            
        }

        function Send(Node, Subject, Value, send) {
            const PL = {};

            if (Node !== undefined) {
                PL.node = Node.id;
            }

            if (Node !== undefined) {
                const N = getNodeInfoForPayload(Node.id, 'name');
                if (N !== undefined) {
                    PL.nodeName = N;
                }
                const L = getNodeInfoForPayload(Node.id, 'location');
                if (L !== undefined) {
                    PL.nodeLocation = L;
                }
            }
            (PL.event = Subject), (PL.timestamp = new Date().toJSON());
            if (Value !== undefined) {
                PL.object = Value;
            }

            let _Subject = '';
            if (Node !== undefined) {
                _Subject = '[Node: ' + Node.id + '] [' + Subject + ']';
            } else {
                _Subject = '[' + Subject + ']';
            }

            Log('debug', 'NDERED', 'OUT', _Subject, 'Forwarding payload...');

            if (send) {
                send({ payload: PL });
            } else {
                node.send({ payload: PL });
            }

            const AllowedSubjectsForDNs = [
                'VALUE_NOTIFICATION',
                'NOTIFICATION',
                'VALUE_UPDATED',
                'SLEEP',
                'WAKE_UP',
                'VALUE_ID_LIST',
                'GET_VALUE_RESPONSE',
                'GET_VALUE_METADATA_RESPONSE'
            ];

            if (AllowedSubjectsForDNs.includes(Subject)) {
                RED.events.emit('zwjs:node:event:all', { payload: PL });
                RED.events.emit('zwjs:node:event:' + Node.id, { payload: PL });
            }
        }

        InitDriver();
        StartDriver();

        function InitDriver() {
            DriverAttempts++;
            try {
                Log('info', 'NDERED', undefined, undefined, 'Initializing Driver...');
                Driver = new ZWaveJS.Driver(config.serialPort, DriverOptions);

                if (
                    config.sendUsageStatistics !== undefined &&
                    config.sendUsageStatistics
                ) {
                    Log('info', 'NDERED', undefined, '[TELEMETRY]', 'Enabling...');
                    Driver.enableStatistics({
                        applicationName: ModulePackage.name,
                        applicationVersion: ModulePackage.version
                    });
                } else {
                    Log('info', 'NDERED', undefined, '[TELEMETRY]', 'Disabling...');
                    Driver.disableStatistics();
                }
            } catch (e) {
                Log('error', 'NDERED', undefined, '[ERROR] [INIT]', e.message);
                node.error(e);
                return;
            }

            WireDriverEvents();
            UI.unregister();
            UI.register(Driver, Input);
        }

        function WireDriverEvents() {
            Driver.on('error', (e) => {
                if (e.code === ZWaveErrorCodes.Driver_Failed) {
                    if (DriverAttempts >= MaxDriverAttempts) {
                        Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
                        node.error(e);
                    } else {
                        Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
                        Log(
                            'debug',
                            'NDERED',
                            undefined,
                            undefined,
                            'Will retry in ' +
                            RetryTime +
                            'ms. Attempted: ' +
                            DriverAttempts +
                            ', Max: ' +
                            MaxDriverAttempts
                        );
                        node.error(
                            new Error(
                                'Driver Failed: Will retry in ' +
                                RetryTime +
                                'ms. Attempted: ' +
                                DriverAttempts +
                                ', Max: ' +
                                MaxDriverAttempts
                            )
                        );
                        InitDriver();
                        setTimeout(StartDriver, RetryTime);
                    }
                } else {
                    Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
                    node.error(e);
                }
            });

            Driver.once('all nodes ready', () => {
                node.status({ fill: 'green', shape: 'dot', text: 'All Nodes Ready!' });
                AllNodesReady = true;
                UI.status('All Nodes Ready!');
            });

            Driver.once('driver ready', () => {
                DriverAttempts = 0;

                node.status({
                    fill: 'yellow',
                    shape: 'dot',
                    text: 'Interviewing Nodes...'
                });
                UI.status('Interviewing Nodes...');

                // Add, Remove
                Driver.controller.on('node added', (N) => {
                    //clearTimeout(RestoreReadyTimer); <--- May no longer need to do this.
                    ShareNodeList();
                    WireNodeEvents(N);
                    Send(N, 'NODE_ADDED');
                    Send(N, 'INTERVIEW_STARTED');
                    node.status({
                        fill: 'yellow',
                        shape: 'dot',
                        text: 'Node: ' + N.id + ' Interview Started.'
                    });
                    UI.status('Node: ' + N.id + ' Interview Started.');
                });

                Driver.controller.on('node removed', (N) => {
                    ShareNodeList();
                    Send(N, 'NODE_REMOVED');
                });

                // Stats
                Driver.controller.on('statistics updated', (S) => {
                    ControllerStats = S;
                });

                // Include
                Driver.controller.on('inclusion started', (Secure) => {
                    Send(undefined, 'INCLUSION_STARTED', { isSecureInclude: Secure });
                    node.status({
                        fill: 'yellow',
                        shape: 'dot',
                        text: 'Inclusion Started. Secure: ' + Secure
                    });
                    UI.status('Inclusion Started. Secure: ' + Secure);
                });

                Driver.controller.on('inclusion failed', () => {
                    Send(undefined, 'INCLUSION_FAILED');
                    node.status({ fill: 'red', shape: 'dot', text: 'Inclusion Failed.' });
                    UI.status('Inclusion Failed.');
                    RestoreReadyStatus();
                });

                Driver.controller.on('inclusion stopped', () => {
                    Send(undefined, 'INCLUSION_STOPPED');
                    node.status({
                        fill: 'green',
                        shape: 'dot',
                        text: 'Inclusion Stopped.'
                    });
                    UI.status('Inclusion Stopped.');
                    //RestoreReadyStatus(); <--- We should only do this, if we, our self, has requested to stop.
                });

                // Exclusion
                Driver.controller.on('exclusion started', () => {
                    Send(undefined, 'EXCLUSION_STARTED');
                    node.status({
                        fill: 'yellow',
                        shape: 'dot',
                        text: 'Exclusion Started.'
                    });
                    UI.status('Exclusion Started.');
                });

                Driver.controller.on('exclusion failed', () => {
                    Send(undefined, 'EXCLUSION_FAILED');
                    node.status({ fill: 'red', shape: 'dot', text: 'Exclusion Failed.' });
                    UI.status('Exclusion Failed.');
                    RestoreReadyStatus();
                });

                Driver.controller.on('exclusion stopped', () => {
                    Send(undefined, 'EXCLUSION_STOPPED');
                    node.status({
                        fill: 'green',
                        shape: 'dot',
                        text: 'Exclusion Stopped.'
                    });
                    UI.status('Exclusion Stopped.');
                    RestoreReadyStatus();
                });

                // Network Heal
                Driver.controller.on('heal network done', () => {
                    Send(undefined, 'NETWORK_HEAL_DONE', {
                        Successful: Heal_Done,
                        Failed: Heal_Failed,
                        Skipped: Heal_Skipped
                    });
                    node.status({
                        fill: 'green',
                        shape: 'dot',
                        text: 'Network Heal Done.'
                    });
                    UI.status('Network Heal Done.');
                    RestoreReadyStatus();
                });

                const Heal_Pending = [];
                const Heal_Done = [];
                const Heal_Failed = [];
                const Heal_Skipped = [];

                Driver.controller.on('heal network progress', (P) => {
                    Heal_Pending.length = 0;
                    Heal_Done.length = 0;
                    Heal_Failed.length = 0;
                    Heal_Skipped.length = 0;

                    P.forEach((V, K) => {
                        switch (V) {
                            case 'pending':
                                Heal_Pending.push(K);
                                break;
                            case 'done':
                                Heal_Done.push(K);
                                break;
                            case 'failed':
                                Heal_Failed.push(K);
                                break;
                            case 'skipped':
                                Heal_Skipped.push(K);
                                break;
                        }
                    });
                    node.status({
                        fill: 'yellow',
                        shape: 'dot',
                        text:
                            'Healing Network Pending:[' +
                            Heal_Pending.toString() +
                            '], Done:[' +
                            Heal_Done.toString() +
                            '], Skipped:[' +
                            Heal_Skipped.toString() +
                            '], Failed:[' +
                            Heal_Failed.toString() +
                            ']'
                    });
                    UI.status(
                        'Healing Network Pending:[' +
                        Heal_Pending.toString() +
                        '], Done:[' +
                        Heal_Done.toString() +
                        '], Skipped:[' +
                        Heal_Skipped.toString() +
                        '], Failed:[' +
                        Heal_Failed.toString() +
                        ']'
                    );
                });

                ShareNodeList();

                Driver.controller.nodes.forEach((ZWN) => {
                    WireNodeEvents(ZWN);
                });
            });
        }

        function WireNodeEvents(Node) {
            Node.on('ready', (N) => {
                if (N.isControllerNode()) {
                    return;
                }

                if (NodesReady.indexOf(N.id) < 0) {
                    NodesReady.push(N.id);
                    node.status({
                        fill: 'yellow',
                        shape: 'dot',
                        text: 'Nodes : ' + NodesReady.toString() + ' Are Ready.'
                    });
                    UI.status('Nodes : ' + NodesReady.toString() + ' Are Ready.');
                }

                Node.on('statistics updated', (N, S) => {
                    NodeStats[Node.id] = S;
                });

                Node.on('firmware update finished', (N, S) => {
                    Send(N, 'FIRMWARE_UPDATE_COMPLETE', S);
                });

                Node.on('value notification', (N, VL) => {
                    Send(N, 'VALUE_NOTIFICATION', VL);
                });

                Node.on('notification', (N, CC, ARGS) => {
                    const OBJ = {
                        ccId: CC,
                        args: ARGS
                    };
                    Send(N, 'NOTIFICATION', OBJ);
                });

                Node.on('value added', (N, VL) => {
                    Send(N, 'VALUE_UPDATED', VL);
                });

                Node.on('value updated', (N, VL) => {
                    Send(N, 'VALUE_UPDATED', VL);
                });

                Node.on('wake up', (N) => {
                    Send(N, 'WAKE_UP');
                });

                Node.on('sleep', (N) => {
                    Send(N, 'SLEEP');
                });
            });

            Node.on('interview started', (N) => {
                Send(N, 'INTERVIEW_STARTED');
                node.status({
                    fill: 'yellow',
                    shape: 'dot',
                    text: 'Node: ' + N.id + ' Interview Started.'
                });
                UI.status('Node: ' + N.id + ' Interview Started.');
                AllNodesReady = false;
            });

            Node.on('interview failed', (N, Er) => {
                Send(N, 'INTERVIEW_FAILED', Er);
                node.status({
                    fill: 'red',
                    shape: 'dot',
                    text: 'Node: ' + N.id + ' Interview Failed.'
                });
                UI.status('Node: ' + N.id + ' Interview Failed.');
                RestoreReadyStatus();
            });

            Node.on('interview completed', (N) => {
                Send(N, 'INTERVIEW_COMPLETE');
                node.status({
                    fill: 'green',
                    shape: 'dot',
                    text: 'Node: ' + N.id + ' Interview Completed.'
                });
                UI.status('Node: ' + N.id + ' Interview Completed.');
                AllNodesReady = true;
                RestoreReadyStatus();
            });
        }

        function StartDriver() {
            Log('info', 'NDERED', undefined, undefined, 'Starting Driver...');
            Driver.start()
                .catch((e) => {
                    if (e.code === ZWaveErrorCodes.Driver_Failed) {
                        if (DriverAttempts >= MaxDriverAttempts) {
                            Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
                            node.error(e);
                        } else {
                            Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
                            Log(
                                'debug',
                                'NDERED',
                                undefined,
                                undefined,
                                'Will retry in ' +
                                RetryTime +
                                'ms. Attempted: ' +
                                DriverAttempts +
                                ', Max: ' +
                                MaxDriverAttempts
                            );
                            node.error(
                                new Error(
                                    'Driver Failed: Will retry in ' +
                                    RetryTime +
                                    'ms. Attempted: ' +
                                    DriverAttempts +
                                    ', Max: ' +
                                    MaxDriverAttempts
                                )
                            );
                            InitDriver();
                            setTimeout(StartDriver, RetryTime);
                        }
                    } else {
                        Log('error', 'NDERED', undefined, '[ERROR] [DRIVER]', e.message);
                        node.error(e);
                    }
                })
                .then(() => {
                    // now what - just sit and wait.
                });
        }
    }

    RED.nodes.registerType('zwave-js', Init);

    RED.httpAdmin.get('/zwjsgetnodelist', function (req, res) {
        res.json(NodeList);
    });

    RED.httpAdmin.get('/zwjsgetversion', function (req, res) {
        res.json({
            zwjsversion: ZWaveJSPackage.version,
            moduleversion: ModulePackage.version
        });
    });

    RED.httpAdmin.get(
        '/zwjsgetports',
        RED.auth.needsPermission('serial.read'),
        function (req, res) {
            SP.list()
                .then((ports) => {
                    const a = ports.map((p) => p.path);
                    res.json(a);
                })
                .catch((err) => {
                    RED.log.error('Error listing serial ports', err);
                    res.json([]);
                });
        }
    );
};
