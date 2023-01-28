import { Driver, NodeStatus, InterviewStage, ProtocolVersion } from 'zwave-js';
import { CommandClasses } from '@zwave-js/core';

export const getNodes = (DriverInstance: Driver): Record<string, unknown>[] => {
	const Collection: Record<string, unknown>[] = [];
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

export const getValueDB = (DriverInstance: Driver, Nodes?: number[]): Record<string, unknown>[] => {
	const DB: Record<string, unknown>[] = [];
	const TargetNodes: number[] = Nodes || [];

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
				values: new Array<unknown>()
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
