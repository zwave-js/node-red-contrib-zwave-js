import { NodeDef } from 'node-red';
export type TypeDriverConfig = NodeDef & {
	FWLicenseKey: string | undefined;
	Name: string;
	SerialPort: string;

	securityKeys_S0_Legacy: string | undefined;
	security_S2_Unauthenticated: string | undefined;
	security_S2_Authenticated: string | undefined;
	security_S2_AccessControl: string | undefined;

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

	//
	USBSoftResetTimeout: number | undefined;
};
