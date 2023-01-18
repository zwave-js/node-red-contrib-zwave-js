import { NodeDef } from 'node-red';
export type Type_ZWaveJSRuntimeConfig = NodeDef & {
	serialPort: string;
	enableGlobalAPI: boolean;
	globalAPIName: string;

	preferences_scales_temperature: number;
	preferences_scales_humidity: number;

	logConfig_level: string;
	LogConfig_nodeFilter: string;

	storage_deviceConfigPriorityDir: string;
	storage_throttle: 'fast' | 'normal' | 'slow';

	disableOptimisticValueUpdate: boolean;
	enableSoftReset: boolean;
	interview_queryAllUserCodes: boolean;

	apiKeys_firmwareUpdateService: string;

	enableStatistics: boolean;

	timeouts_ack: number;
	timeouts_response: number;
	timeouts_sendDataCallback: number;
	timeouts_report: number;
	timeouts_serialAPIStarted: number;
};

export type Type_ZWaveJSRuntimeCredentialConfig = {
	securityKeys_S0_Legacy: string;
	securityKeys_S2_Unauthenticated: string;
	securityKeys_S2_Authenticated: string;
	securityKeys_S2_AccessControl: string;
};
