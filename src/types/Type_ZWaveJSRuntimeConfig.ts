import { NodeDef } from 'node-red';
export type Type_ZWaveJSRuntimeConfig = NodeDef & {
	name: string;
	serialPort: string;
	enableGlobalAPI: boolean;
	globalAPIName: string | undefined;

	securityKeys_S0_Legacy: string | undefined;
	securityKeys_S2_Unauthenticated: string | undefined;
	securityKeys_S2_Authenticated: string | undefined;
	securityKeys_S2_AccessControl: string | undefined;

	preferences_scales_temperature: number;
	preferences_scales_humidity: number;

	logConfig_level: string;
	logConfig_filename: string | undefined;
	LogConfig_nodeFilter: string | undefined;

	storage_deviceConfigPriorityDir: string | undefined;
	storage_throttle: 'fast' | 'normal' | 'slow';

	disableOptimisticValueUpdate: boolean;
	enableSoftReset: boolean;
	interview_queryAllUserCodes: boolean;

	apiKeys_firmwareUpdateService: string | undefined;

	enableStatistics: boolean;
};
