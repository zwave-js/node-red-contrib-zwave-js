import { Node, NodeDef } from 'node-red';

export type Type_ZWaveJSFactory = Node & {
	config: Type_ZWaveJSFactoryConfig;
};

export type Type_ZWaveJSFactoryConfig = NodeDef & {
	api: string;
	method: string;
	commandClass?: string;
	valueId?: string;
	nodeId: string;
	endpoint?: string;
	value?: string;
	valueSetOptions?: string;
	args?: string;
	trackingToken?: string;
};
