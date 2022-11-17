"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const Type_ZWaveJSRuntime_1 = require("../types/Type_ZWaveJSRuntime");
const zwave_js_1 = require("zwave-js");
const Fetchers_1 = require("../lib/Fetchers");
const ControllerAPI_1 = require("../lib/ControllerAPI");
const APP_NAME = 'node-red-contrib-zwave-js';
const APP_VERSION = '9.0.0';
const FWK = '127c49b6f2928a6579e82ecab64a83fc94a6436f03d5cb670b8ac44412687b75f0667843';
class SanitizedEventName {
    constructor(event) {
        this.driverName = event;
        this.redEventName = event.replace(/ /g, '_').toUpperCase();
        this.nodeStatusName = event.charAt(0).toUpperCase() + event.substr(1).toLowerCase() + '.';
        this.statusNameWithNode = (Node) => {
            return `Node: ${Node.id} ${this.nodeStatusName}`;
        };
    }
}
const event_DriverReady = new SanitizedEventName('driver ready');
const event_AllNodesReady = new SanitizedEventName('all nodes ready');
const event_NodeAdded = new SanitizedEventName('node added');
const event_NodeRemoved = new SanitizedEventName('node removed');
const event_InclusionStarted = new SanitizedEventName('inclusion started');
const event_InclusionFailed = new SanitizedEventName('inclusion failed');
const event_InclusionStopped = new SanitizedEventName('inclusion stopped');
const event_ExclusionStarted = new SanitizedEventName('exclusion started');
const event_ExclusionFailed = new SanitizedEventName('exclusion failed');
const event_ExclusionStopped = new SanitizedEventName('exclusion stopped');
const event_NetworkHealDone = new SanitizedEventName('heal network done');
const event_ValueNotification = new SanitizedEventName('value notification');
const event_Notification = new SanitizedEventName('notification');
const event_ValueUpdated = new SanitizedEventName('value updated');
const event_ValueAdded = new SanitizedEventName('value added');
const event_Wake = new SanitizedEventName('wake up');
const event_Sleep = new SanitizedEventName('sleep');
const event_Dead = new SanitizedEventName('dead');
const event_Alive = new SanitizedEventName('alive');
const event_InterviewStarted = new SanitizedEventName('interview started');
const event_InterviewFailed = new SanitizedEventName('interview failed');
const event_InterviewCompleted = new SanitizedEventName('interview completed');
const event_Ready = new SanitizedEventName('ready');
const event_HealNetworkProgress = new SanitizedEventName('heal network progress');
module.exports = (RED) => {
    const init = function (config) {
        const self = this;
        RED.nodes.createNode(self, config);
        self.config = config;
        let controllerNodes = {};
        let deviceNodes = {};
        self.registerDeviceNode = (DeviceNodeID, NodeIDs, Callback) => {
            deviceNodes[DeviceNodeID] = { NodeIDs, Callback };
        };
        self.deregisterDeviceNode = (DeviceNodeID) => {
            delete deviceNodes[DeviceNodeID];
        };
        self.registerControllerNode = (ControllerNodeID, Callback) => {
            controllerNodes[ControllerNodeID] = Callback;
        };
        self.deregisterControllerNode = (ControllerNodeID) => {
            delete controllerNodes[ControllerNodeID];
        };
        self.controllerCommand = (APITarget, Method, Params) => {
            switch (APITarget) {
                case Type_ZWaveJSRuntime_1.API.CONTROLLER_API:
                    return (0, ControllerAPI_1.process)(self.driverInstance, Method, Params);
                default:
                    return Promise.reject('Invalid API');
            }
        };
        let lastStatus;
        const updateLatestStatus = (Status) => {
            lastStatus = Status;
            RED.comms.publish(`zwave-js/ui/${self.id}/status`, { status: lastStatus }, false);
        };
        const exposeGlobalAPI = () => {
            if (self.config.enableGlobalAPI) {
                const API = {
                    Utilities: {
                        getValueDB: function (Nodes) {
                            return (0, Fetchers_1.getValueDB)(self.driverInstance, Nodes);
                        },
                        getNodes: function () {
                            return (0, Fetchers_1.getNodes)(self.driverInstance);
                        },
                        ping: function (Node) {
                            return self.driverInstance?.controller.nodes.get(Node)?.ping();
                        }
                    },
                    CCAPI: {
                        invokeCCAPI: function (Node, CC, Method, ...Args) {
                            return self.driverInstance?.controller.nodes.get(Node)?.invokeCCAPI(CC, Method, Args);
                        },
                        supportsCC: function (Node, CC) {
                            return self.driverInstance?.controller.nodes.get(Node)?.supportsCC(CC);
                        },
                        supportsCCAPI: function (Node, CC) {
                            return self.driverInstance?.controller.nodes.get(Node)?.supportsCCAPI(CC);
                        }
                    },
                    ValueAPI: {
                        getValue: function (Node, VID) {
                            return self.driverInstance?.controller.nodes.get(Node)?.getValue(VID);
                        },
                        setValue: function (Node, VID, Value) {
                            return self.driverInstance?.controller.nodes.get(Node)?.setValue(VID, Value);
                        },
                        pollValue: function (Node, VID) {
                            return self.driverInstance?.controller.nodes.get(Node)?.pollValue(VID);
                        },
                        getDefinedValueIDs: function (Node) {
                            return self.driverInstance?.controller.nodes.get(Node)?.getDefinedValueIDs();
                        },
                        getValueMetadata: function (Node, VID) {
                            return self.driverInstance?.controller.nodes.get(Node)?.getValueMetadata(VID);
                        }
                    }
                };
                Object.defineProperty(API, 'Utilities', {
                    writable: false
                });
                Object.defineProperty(API, 'CCAPI', {
                    writable: false
                });
                Object.defineProperty(API, 'ValueAPI', {
                    writable: false
                });
                const Name = self.config.globalAPIName || self.id;
                self.context().global.set(`ZWJS-${Name}`, API);
            }
        };
        const removeGlobalAPI = () => {
            const Name = self.config.globalAPIName || self.id;
            self.context().global.set(`ZWJS-${Name}`, undefined);
        };
        const createHTTPAPI = () => {
            RED.comms.publish('zwave-js/ui/global/addnetwork', { name: self.config.name, id: self.id }, false);
            RED.httpAdmin.get(`/zwave-js/ui/${self.id}/nodes`, RED.auth.needsPermission('flows.write'), (_, response) => {
                response.json((0, Fetchers_1.getNodes)(self.driverInstance));
            });
            RED.httpAdmin.get(`/zwave-js/ui/${self.id}/getValueDB/:Node`, RED.auth.needsPermission('flows.write'), (request, response) => {
                const Node = parseInt(request.params.Node);
                response.json((0, Fetchers_1.getValueDB)(self.driverInstance, [Node]));
            });
            RED.httpAdmin.get(`/zwave-js/ui/${self.id}/status`, RED.auth.needsPermission('flows.write'), (_, response) => {
                response.json({ status: lastStatus });
            });
        };
        const removeHTTPAPI = () => {
            const Check = (Route) => {
                if (Route.route === undefined)
                    return true;
                if (!Route.route.path.startsWith(`/zwave-js/ui/${self.id}`))
                    return true;
                return false;
            };
            RED.comms.publish('zwave-js/ui/global/removenetwork', { id: self.id }, false);
            RED.httpAdmin._router.stack = RED.httpAdmin._router.stack.filter(Check);
        };
        self.on('close', (_, done) => {
            removeGlobalAPI();
            removeHTTPAPI();
            controllerNodes = {};
            deviceNodes = {};
            if (self.driverInstance) {
                self.driverInstance?.destroy().then(() => {
                    self.driverInstance = undefined;
                    done();
                });
            }
            else {
                done();
            }
        });
        const s2Void = () => { };
        const grantSecurityClasses = (Request) => {
            return new Promise((resolve) => {
                resolve(Request);
            });
        };
        const validateDSKAndEnterPIN = (DSK) => {
            return new Promise((resolve) => {
                resolve(DSK);
            });
        };
        const ZWaveOptions = {
            logConfig: {},
            storage: {
                throttle: self.config.storage_throttle,
                cacheDir: path_1.default.join(RED.settings.userDir, 'zwave-js-cache')
            },
            preferences: {
                scales: {
                    temperature: self.config.preferences_scales_temperature,
                    humidity: self.config.preferences_scales_humidity
                }
            },
            interview: {
                queryAllUserCodes: self.config.interview_queryAllUserCodes
            },
            securityKeys: {},
            apiKeys: {
                firmwareUpdateService: self.config.apiKeys_firmwareUpdateService || FWK
            },
            inclusionUserCallbacks: {
                grantSecurityClasses: grantSecurityClasses,
                validateDSKAndEnterPIN: validateDSKAndEnterPIN,
                abort: s2Void
            },
            disableOptimisticValueUpdate: !self.config.disableOptimisticValueUpdate,
            enableSoftReset: self.config.enableSoftReset
        };
        ZWaveOptions.logConfig.enabled = self.config.logConfig_level !== 'off';
        ZWaveOptions.logConfig.logToFile = self.config.logConfig_level !== 'off';
        ZWaveOptions.logConfig.filename = self.config.logConfig_filename || path_1.default.join(RED.settings.userDir, 'zwavejs');
        if (ZWaveOptions.logConfig.enabled)
            ZWaveOptions.logConfig.level = self.config.logConfig_level;
        let nodeLogFilter;
        if (self.config.LogConfig_nodeFilter) {
            nodeLogFilter = self.config.LogConfig_nodeFilter.split(',').map((N) => parseInt(N.trim()));
            ZWaveOptions.logConfig.nodeFilter = nodeLogFilter;
        }
        if (self.config.securityKeys_S0_Legacy)
            ZWaveOptions.securityKeys.S0_Legacy = Buffer.from(self.config.securityKeys_S0_Legacy, 'hex');
        if (self.config.securityKeys_S2_AccessControl)
            ZWaveOptions.securityKeys.S2_AccessControl = Buffer.from(self.config.securityKeys_S2_AccessControl, 'hex');
        if (self.config.securityKeys_S2_Authenticated)
            ZWaveOptions.securityKeys.S2_Authenticated = Buffer.from(self.config.securityKeys_S2_Authenticated, 'hex');
        if (self.config.securityKeys_S2_Unauthenticated)
            ZWaveOptions.securityKeys.S2_Unauthenticated = Buffer.from(self.config.securityKeys_S2_Unauthenticated, 'hex');
        const wireDriverEvents = () => {
            self.driverInstance?.once(event_DriverReady.driverName, () => {
                exposeGlobalAPI();
                createHTTPAPI();
                wireSubDriverEvents();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'yellow',
                        shape: 'dot',
                        text: 'Initializing network...'
                    }
                };
                updateLatestStatus('Initializing network...');
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Status);
                });
                self.driverInstance?.controller.nodes.forEach((Node) => {
                    wireNodeEvents(Node);
                });
            });
        };
        const wireSubDriverEvents = () => {
            self.driverInstance?.on(event_AllNodesReady.driverName, () => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_AllNodesReady.redEventName, timestamp: Timestamp }
                };
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'green',
                        shape: 'dot',
                        text: event_AllNodesReady.nodeStatusName,
                        clearTime: 5000
                    }
                };
                updateLatestStatus(event_AllNodesReady.nodeStatusName);
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
            });
            self.driverInstance?.controller.on(event_NodeAdded.driverName, (Node) => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_NodeAdded.redEventName, timestamp: Timestamp, nodeId: Node.id }
                };
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'green',
                        shape: 'dot',
                        text: event_NodeAdded.statusNameWithNode(Node),
                        clearTime: 5000
                    }
                };
                updateLatestStatus(event_NodeAdded.statusNameWithNode(Node));
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
                wireNodeEvents(Node);
            });
            self.driverInstance?.controller.on(event_NodeRemoved.driverName, (Node) => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_NodeRemoved.redEventName, timestamp: Timestamp, nodeId: Node.id }
                };
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'green',
                        shape: 'dot',
                        text: event_NodeRemoved.statusNameWithNode(Node),
                        clearTime: 5000
                    }
                };
                updateLatestStatus(event_NodeRemoved.statusNameWithNode(Node));
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
            });
            self.driverInstance?.controller.on(event_InclusionStarted.driverName, (IsSecure) => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Body = {
                    isSecureInclude: IsSecure
                };
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_InclusionStarted.redEventName, timestamp: Timestamp, eventBody: Body }
                };
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'yellow',
                        shape: 'dot',
                        text: event_InclusionStarted.nodeStatusName
                    }
                };
                updateLatestStatus(event_InclusionStarted.nodeStatusName);
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
            });
            self.driverInstance?.controller.on(event_InclusionFailed.driverName, () => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_InclusionFailed.redEventName, timestamp: Timestamp }
                };
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'red',
                        shape: 'dot',
                        text: event_InclusionFailed.nodeStatusName,
                        clearTime: 5000
                    }
                };
                updateLatestStatus(event_InclusionFailed.nodeStatusName);
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
            });
            self.driverInstance?.controller.on(event_InclusionStopped.driverName, () => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_InclusionStopped.redEventName, timestamp: Timestamp }
                };
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'yellow',
                        shape: 'ring',
                        text: event_InclusionStopped.nodeStatusName,
                        clearTime: 5000
                    }
                };
                updateLatestStatus(event_InclusionStopped.nodeStatusName);
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
            });
            self.driverInstance?.controller.on(event_ExclusionStarted.driverName, () => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_ExclusionStarted.redEventName, timestamp: Timestamp }
                };
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'yellow',
                        shape: 'dot',
                        text: event_ExclusionStarted.nodeStatusName
                    }
                };
                updateLatestStatus(event_ExclusionStarted.nodeStatusName);
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
            });
            self.driverInstance?.controller.on(event_ExclusionFailed.driverName, () => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_ExclusionFailed.redEventName, timestamp: Timestamp }
                };
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'red',
                        shape: 'dot',
                        text: event_ExclusionFailed.nodeStatusName,
                        clearTime: 5000
                    }
                };
                updateLatestStatus(event_ExclusionFailed.nodeStatusName);
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
            });
            self.driverInstance?.controller.on(event_ExclusionStopped.driverName, () => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_ExclusionStopped.redEventName, timestamp: Timestamp }
                };
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'yellow',
                        shape: 'ring',
                        text: event_ExclusionStopped.nodeStatusName,
                        clearTime: 5000
                    }
                };
                updateLatestStatus(event_ExclusionStopped.nodeStatusName);
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
            });
            self.driverInstance?.controller.on(event_NetworkHealDone.driverName, (Result) => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_NetworkHealDone.redEventName, timestamp: Timestamp, eventBody: Result }
                };
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'green',
                        shape: 'dot',
                        text: event_NetworkHealDone.nodeStatusName,
                        clearTime: 5000
                    }
                };
                updateLatestStatus(event_NetworkHealDone.nodeStatusName);
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
            });
            self.driverInstance?.controller.on(event_HealNetworkProgress.driverName, (Progress) => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_HealNetworkProgress.redEventName, timestamp: Timestamp, eventBody: Progress }
                };
                const Count = Progress.size;
                const Remain = [...Progress.values()].filter((V) => V === 'pending').length;
                const Completed = Count - Remain;
                const CompletedPercentage = Math.round((100 * Completed) / (Completed + Remain));
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'yellow',
                        shape: 'dot',
                        text: `Heal network progress : ${CompletedPercentage}%`
                    }
                };
                updateLatestStatus(`Heal network progress : ${CompletedPercentage}%`);
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
            });
        };
        const wireNodeEvents = (Node) => {
            if (Node.isControllerNode) {
                return;
            }
            [event_Ready, event_Alive, event_Dead, event_Wake, event_Sleep].forEach((ThisEvent) => {
                Node.on(ThisEvent.driverName, (ThisNode) => {
                    const Timestamp = new Date().getTime();
                    const InterestedDeviceNodes = Object.values(deviceNodes).filter((I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined);
                    const Event = {
                        Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                        Event: {
                            event: ThisEvent.redEventName,
                            timestamp: Timestamp,
                            nodeId: ThisNode.id,
                            nodeName: ThisNode.name,
                            nodeLocation: ThisNode.location
                        }
                    };
                    InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
                });
            });
            Node.on(event_InterviewStarted.driverName, (ThisNode) => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_InterviewStarted.redEventName, timestamp: Timestamp }
                };
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'yellow',
                        shape: 'dot',
                        text: event_InterviewStarted.statusNameWithNode(ThisNode)
                    }
                };
                updateLatestStatus(event_InterviewStarted.statusNameWithNode(ThisNode));
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
            });
            Node.on(event_InterviewCompleted.driverName, (ThisNode) => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_InterviewCompleted.redEventName, timestamp: Timestamp }
                };
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'green',
                        shape: 'dot',
                        text: event_InterviewCompleted.statusNameWithNode(ThisNode),
                        clearTime: 5000
                    }
                };
                updateLatestStatus(event_InterviewCompleted.statusNameWithNode(ThisNode));
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
            });
            Node.on(event_InterviewFailed.driverName, (ThisNode, Args) => {
                const Timestamp = new Date().getTime();
                const ControllerNodeIDs = Object.keys(controllerNodes);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: event_InterviewFailed.redEventName, timestamp: Timestamp, eventBody: Args }
                };
                const Status = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.STATUS,
                    Status: {
                        fill: 'red',
                        shape: 'dot',
                        text: event_InterviewFailed.statusNameWithNode(ThisNode),
                        clearTime: 5000
                    }
                };
                updateLatestStatus(event_InterviewFailed.statusNameWithNode(ThisNode));
                ControllerNodeIDs.forEach((ID) => {
                    controllerNodes[ID](Event);
                    controllerNodes[ID](Status);
                });
            });
            Node.on(event_ValueNotification.driverName, (ThisNode, Args) => {
                const Timestamp = new Date().getTime();
                const InterestedDeviceNodes = Object.values(deviceNodes).filter((I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: {
                        event: event_ValueNotification.redEventName,
                        timestamp: Timestamp,
                        nodeId: ThisNode.id,
                        nodeName: ThisNode.name,
                        nodeLocation: ThisNode.location,
                        eventBody: Args
                    }
                };
                InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
            });
            Node.on(event_ValueUpdated.driverName, (ThisNode, Args) => {
                const Timestamp = new Date().getTime();
                const InterestedDeviceNodes = Object.values(deviceNodes).filter((I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: {
                        event: event_ValueUpdated.redEventName,
                        timestamp: Timestamp,
                        nodeId: ThisNode.id,
                        nodeName: ThisNode.name,
                        nodeLocation: ThisNode.location,
                        eventBody: Args
                    }
                };
                InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
            });
            Node.on(event_ValueAdded.driverName, (ThisNode, Args) => {
                const Timestamp = new Date().getTime();
                const InterestedDeviceNodes = Object.values(deviceNodes).filter((I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: {
                        event: event_ValueAdded.redEventName,
                        timestamp: Timestamp,
                        nodeId: ThisNode.id,
                        nodeName: ThisNode.name,
                        nodeLocation: ThisNode.location,
                        eventBody: Args
                    }
                };
                InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
            });
            Node.on(event_Notification.driverName, (ThisNode, CC, Args) => {
                const Timestamp = new Date().getTime();
                const InterestedDeviceNodes = Object.values(deviceNodes).filter((I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined);
                const Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: {
                        event: event_Notification.redEventName,
                        timestamp: Timestamp,
                        nodeId: ThisNode.id,
                        nodeName: ThisNode.name,
                        nodeLocation: ThisNode.location,
                        eventBody: { ccId: CC, args: Args }
                    }
                };
                InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
            });
        };
        try {
            self.driverInstance = new zwave_js_1.Driver(self.config.serialPort, ZWaveOptions);
        }
        catch (err) {
            self.error(err);
            return;
        }
        if (self.config.enableStatistics) {
            self.driverInstance?.enableStatistics({
                applicationName: APP_NAME,
                applicationVersion: APP_VERSION
            });
        }
        else {
            self.driverInstance?.disableStatistics();
        }
        wireDriverEvents();
        self.driverInstance?.on('error', (Err) => {
            console.log(Err);
        });
        self.driverInstance
            .start()
            .catch((e) => {
            self.error(e);
            return;
        })
            .then(() => { });
    };
    RED.nodes.registerType('zwavejs-runtime', init);
};
