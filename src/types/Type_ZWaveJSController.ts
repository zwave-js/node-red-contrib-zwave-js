import { Node } from 'node-red';
import { Type_ZWaveJSControllerConfig } from './Type_ZWaveJSControllerConfig';
import { Type_ZWaveJSRuntime } from './Type_ZWaveJSRuntime';

export type Type_ZWaveJSController = Node & {
	config: Type_ZWaveJSControllerConfig;
	runtime: Type_ZWaveJSRuntime;
};
