import { Node, NodeDef } from 'node-red';
import { Driver, ValueID, ZWaveNode } from 'zwave-js';
import { CommandClasses } from '@zwave-js/core';

// Event hook class
export class SanitizedEventName<T extends string> {
	driverName: T;
	redEventName: string;
	nodeStatusName: string;
	statusNameWithNode: (Node: ZWaveNode) => string;

	constructor(event: T) {
		this.driverName = event;
		this.redEventName = event.replace(/ /g, '_').toUpperCase();
		this.nodeStatusName = event.charAt(0).toUpperCase() + event.substr(1).toLowerCase() + '.';
		this.statusNameWithNode = (Node) => {
			return `Node: ${Node.id} ${this.nodeStatusName}`;
		};
	}
}

export enum MessageType {
	STATUS = 0,
	EVENT
}

export enum API {
	CONTROLLER = 0,
	VALUE,
	CC,
	NODE
}

export interface StatusMessage {
	fill: 'red' | 'green' | 'yellow' | 'blue' | 'grey';
	shape: 'ring' | 'dot';
	text: string;
	clearTime?: number;
}

export interface EventMessage {
	event: string;
	timestamp: number;
	nodeId?: number;
	nodeName?: string;
	nodeLocation?: string;
	eventBody?: unknown;
}

export type UserPayloadPackage =
	| { Type: MessageType.STATUS; Status: StatusMessage }
	| { Type: MessageType.EVENT; Event: EventMessage };

export type ControllerCallback = (Data: UserPayloadPackage) => void;
export type DeviceCallback = (Data: UserPayloadPackage) => void;

export type Type_ZWaveJSRuntime = Node & {
	config: Type_ZWaveJSRuntimeConfig;
	driverInstance?: Driver;
	registerDeviceNode(deviceNodeId: string, nodeIds: number[] | undefined, callback: DeviceCallback): void;
	deregisterDeviceNode(deviceNodeId: string): void;
	registerControllerNode(controllerNodeId: string, callback: ControllerCallback): void;
	deregisterControllerNode(controllerNodeId: string): void;
	controllerCommand(Method: string, Args?: unknown[]): Promise<unknown>;
	valueCommand(
		Method: string,
		NodeID: number,
		VID: ValueID,
		Value?: unknown,
		ValueOptions?: Record<string, unknown>
	): Promise<unknown>;
	ccCommand(
		Method: string,
		CommandClass: CommandClasses,
		CommandClassMethod: string,
		NodeID: number,
		Endpoint?: number,
		Args?: unknown[]
	): Promise<unknown>;

	nodeCommand(Method: string, NodeID: number, Value?: unknown): Promise<unknown>;
};

export type Type_ZWaveJSRuntimeConfig = NodeDef & {
	serialPort: string;
	enableGlobalAPI: boolean;
	globalAPIName?: string;

	preferences_scales_temperature: string;
	preferences_scales_humidity: string;

	logConfig_level: string;
	LogConfig_nodeFilter?: string;

	storage_deviceConfigPriorityDir?: string;
	storage_throttle: 'fast' | 'normal' | 'slow';

	disableOptimisticValueUpdate: boolean;
	enableSoftReset: boolean;
	interview_queryAllUserCodes: boolean;

	apiKeys_firmwareUpdateService?: string;

	enableStatistics: boolean;

	timeouts_ack?: string;
	timeouts_response?: string;
	timeouts_sendDataCallback?: string;
	timeouts_report?: string;
	timeouts_serialAPIStarted?: string;

	securityKeys_S0_Legacy: string;
	securityKeys_S2_Unauthenticated: string;
	securityKeys_S2_Authenticated: string;
	securityKeys_S2_AccessControl: string;
};
