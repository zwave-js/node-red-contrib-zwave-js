import { Node, NodeDef } from 'node-red';
import { SetValueAPIOptions, ValueID } from 'zwave-js';
import { CommandClasses } from '@zwave-js/core';

import { Type_ZWaveJSRuntime } from './Type_ZWaveJSRuntime';

export type InputMessage = {
	cmd: {
		api: 'VALUE' | 'CC' | 'NODE';
		method: string;
		trackingToken?: unknown;
	};
	cmdProperties?: {
		nodeId?: number;
		commandClass?: CommandClasses;
		method?: string;
		endpoint?: number;
		value?: unknown;
		valueId?: ValueID;
		setValueOptions?: SetValueAPIOptions;
		args?: unknown[];
	};
};

export type Type_ZWaveJSDevice = Node & {
	config: Type_ZWaveJSDeviceConfig;
	runtime: Type_ZWaveJSRuntime;
};

export type Type_ZWaveJSDeviceConfig = NodeDef & {
	runtimeId: string;
	nodemode: string;
	multimode: string;
	datamode: string;
};
