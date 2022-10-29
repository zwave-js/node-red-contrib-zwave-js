import { Node } from 'node-red';
import { TypeDriverConfig } from './TypeDriverConfig';
import { Driver } from 'zwave-js';

export enum MessageType {
	STATUS = 0,
	EVENT
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

export type TypeDriver = Node & {
	config: TypeDriverConfig;
	driverInstance?: Driver;
	registerDeviceNode(deviceNodeId: string, nodeIds: number[], callback: DeviceCallback): void;
	deregisterDeviceNode(deviceNodeId: string): void;
	registerControllerNode(controllerNodeId: string, callback: ControllerCallback): void;
	deregisterControllerNode(controllerNodeId: string): void;
};
