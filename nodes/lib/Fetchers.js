const { NodeStatus, InterviewStage, InclusionState, ProtocolVersion, num2hex } = require('zwave-js');
const { CommandClasses } = require('@zwave-js/core');

const getNodes = (DriverInstance) => {
	const Collection = [];
	DriverInstance.controller.nodes.forEach((N) => {
		Collection.push({
			nodeId: N.id,
			nodeName: N.name,
			nodeLocation: N.location,
			status: NodeStatus[N.status],
			ready: N.ready,
			interviewStage: InterviewStage[N.interviewStage],
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
			protocolVersion: N.protocolVersion ? ProtocolVersion[N.protocolVersion] : undefined,
			manufacturerId: N.manufacturerId,
			productId: N.productId,
			productType: N.productType,
			firmwareVersion: N.firmwareVersion,
			deviceConfig: N.deviceConfig,
			isControllerNode: N.isControllerNode,
			supportsBeaming: N.supportsBeaming,
			keepAwake: N.keepAwake,
			homeId: N.isControllerNode ? num2hex(DriverInstance.controller.homeId, true) : undefined,
			inclusionState: N.isControllerNode ? InclusionState[DriverInstance.controller.inclusionState] : undefined,
			supportsLongRange: N.isControllerNode ? DriverInstance.controller.supportsLongRange : undefined,
			powerSource: {
				type: N.supportsCC(CommandClasses.Battery) ? 'battery' : 'mains',
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
				const TS = ZWN.getValueTimestamp(VID);

				const VI = {
					currentValue: Value,
					valueTimestamp: TS,
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

module.exports = {
	getNodes,
	getValueDB
};
