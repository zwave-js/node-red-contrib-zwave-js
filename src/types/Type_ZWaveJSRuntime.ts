import { Node } from 'node-red';
import { Type_ZWaveJSRuntimeConfig, Type_ZWaveJSRuntimeCredentialConfig } from './Type_ZWaveJSRuntimeConfig';
import { Driver, ValueID } from 'zwave-js';
import { CommandClasses } from '@zwave-js/core';

export enum MessageType {
	STATUS = 0,
	EVENT
}

export enum API {
	CONTROLLER = 0,
	VALUE,
	CC
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
	credentials: Type_ZWaveJSRuntimeCredentialConfig;
	driverInstance?: Driver;
	registerDeviceNode(deviceNodeId: string, nodeIds: number[], callback: DeviceCallback): void;
	deregisterDeviceNode(deviceNodeId: string): void;
	registerControllerNode(controllerNodeId: string, callback: ControllerCallback): void;
	deregisterControllerNode(controllerNodeId: string): void;
	controllerCommand(Method: string, Params?: any[]): Promise<any>;
	valueCommand(
		Method: string,
		NodeID: number,
		VID: ValueID,
		Value?: any,
		ValueOptions?: Record<string, any>
	): Promise<any>;
	ccCommand(CC: CommandClasses, CCMethod: string, NodeID: number, Endpoint?: number, Argumnets?: any[]): Promise<any>;
};
