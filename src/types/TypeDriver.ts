import { Node } from 'node-red';
import { TypeDriverConfig } from './TypeDriverConfig';
import { Driver } from 'zwave-js';

export enum ControllerMessageType {
	STATUS = 0,
	EVENT
}

export type ControllerCallback = (Type: ControllerMessageType, Payload: any) => void;
export type DeviceCallback = (Payload: any) => void;

export type TypeDriver = Node & {
	config: TypeDriverConfig;
	driverInstance?: Driver;
	registerDeviceNode(deviceNodeId: string, nodeIds: number[], callback: DeviceCallback): void;
	deregisterDeviceNode(deviceNodeId: string): void;
	registerControllerNode(controllerNodeId: string, callback: ControllerCallback): void;
	deregisterControllerNode(controllerNodeId: string): void;
};
