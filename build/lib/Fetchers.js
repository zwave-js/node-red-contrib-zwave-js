"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValueDB = exports.getNodes = void 0;
const zwave_js_1 = require("zwave-js");
const core_1 = require("@zwave-js/core");
const getNodes = (DriverInstance) => {
    const Collection = [];
    DriverInstance.controller.nodes.forEach((N) => {
        Collection.push({
            nodeId: N.id,
            nameName: N.name,
            nodeLocation: N.location,
            status: zwave_js_1.NodeStatus[N.status],
            ready: N.ready,
            interviewStage: zwave_js_1.InterviewStage[N.interviewStage],
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
            protocolVersion: N.protocolVersion ? zwave_js_1.ProtocolVersion[N.protocolVersion] : undefined,
            manufacturerId: N.manufacturerId,
            productId: N.productId,
            productType: N.productType,
            firmwareVersion: N.firmwareVersion,
            deviceConfig: N.deviceConfig,
            isControllerNode: N.isControllerNode,
            supportsBeaming: N.supportsBeaming,
            keepAwake: N.keepAwake,
            powerSource: {
                type: N.supportsCC(core_1.CommandClasses.Battery) ? 'battery' : 'mains',
                level: N.getValue({
                    commandClass: 128,
                    endpoint: 0,
                    property: 'level'
                }),
                isLow: N.getValue({
                    commandClass: 128,
                    endpoint: 0,
                    property: 'isLow'
                })
            },
            statistics: N.isControllerNode ? DriverInstance.controller.statistics : N.statistics
        });
    });
    return Collection;
};
exports.getNodes = getNodes;
const getValueDB = (DriverInstance, Nodes) => {
    const DB = [];
    const TargetNodes = Nodes || [];
    if (!Nodes) {
        DriverInstance.controller.nodes.forEach((N) => {
            if (!N.isControllerNode) {
                TargetNodes.push(N.id);
            }
        });
    }
    TargetNodes.forEach((N) => {
        const ZWN = DriverInstance.controller.nodes.get(N);
        if (ZWN) {
            const NodeData = {
                nodeId: ZWN.id,
                values: []
            };
            const VIDs = ZWN.getDefinedValueIDs();
            VIDs.forEach((VID) => {
                const Meta = ZWN.getValueMetadata(VID);
                const Value = ZWN.getValue(VID);
                const VI = {
                    currentValue: Value,
                    valueId: VID,
                    metadata: Meta
                };
                NodeData.values.push(VI);
            });
            DB.push(NodeData);
        }
    });
    return DB;
};
exports.getValueDB = getValueDB;
