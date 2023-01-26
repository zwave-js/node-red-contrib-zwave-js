import { Node } from 'node-red';
import { Type_ZWaveJSRuntimeConfig, Type_ZWaveJSRuntimeCredentialConfig } from './Type_ZWaveJSRuntimeConfig';
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
	credentials: Type_ZWaveJSRuntimeCredentialConfig;
	driverInstance?: Driver;
	registerDeviceNode(deviceNodeId: string, nodeIds: number[], callback: DeviceCallback): void;
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
};
