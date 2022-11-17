import { Node } from 'node-red';
import { Type_ZWaveJSRuntimeConfig } from './Type_ZWaveJSRuntimeConfig';
import { Driver } from 'zwave-js';

export enum MessageType {
	STATUS = 0,
	EVENT
}

export enum API {
	CONTROLLER_API = 0,
	VALUE_API,
	CC_API
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
	eventBody?: Record<string, any>;
}

export type ControllerCallbackObject =
	| { Type: MessageType.STATUS; Status: StatusMessage }
	| { Type: MessageType.EVENT; Event: EventMessage };

export type DeviceCallbackObject =
	| { Type: MessageType.STATUS; Status: StatusMessage }
	| { Type: MessageType.EVENT; Event: EventMessage };

export type ControllerCallback = (Data: ControllerCallbackObject) => void;
export type DeviceCallback = (Data: DeviceCallbackObject) => void;

export type Type_ZWaveJSRuntime = Node & {
	config: Type_ZWaveJSRuntimeConfig;
	driverInstance?: Driver;
	registerDeviceNode(deviceNodeId: string, nodeIds: number[], callback: DeviceCallback): void;
	deregisterDeviceNode(deviceNodeId: string): void;
	registerControllerNode(controllerNodeId: string, callback: ControllerCallback): void;
	deregisterControllerNode(controllerNodeId: string): void;
	controllerCommand(API: API, Method: string, Params?: any[]): Promise<ControllerCallbackObject | boolean | undefined>;
};
