import { NodeAPI } from 'node-red';
import { TypeDriverConfig } from '../types/TypeDriverConfig';
import { TypeDriver, ControllerMessageType, ControllerCallback, DeviceCallback } from '../types/TypeDriver';
import { Driver, ZWaveNode } from 'zwave-js';
import ModulePackageFile from '../../package.json';

class SanitizedEventName {
	zwaveName: any;
	redName: string;
	statusName: string;
	statusNameWithNode: (Node: ZWaveNode) => string;

	constructor(event: string) {
		this.zwaveName = event;
		this.redName = event.replace(/ /g, '_').toUpperCase();
		this.statusName = event.charAt(0).toUpperCase() + event.substr(1).toLowerCase() + '.';
		this.statusNameWithNode = (Node) => {
			return `Node: ${Node.id} ${this.statusName}`;
		};
	}
}

const event_DriverReady = new SanitizedEventName('driver ready');
const event_AllNodesReady = new SanitizedEventName('all nodes ready');
const event_NodeAdded = new SanitizedEventName('node added');
const event_NodeRemoved = new SanitizedEventName('node removed');
const event_InclusionStarted = new SanitizedEventName('inclusion started');
const event_InclusionFailed = new SanitizedEventName('inclusion failed');
const event_InclusionStopped = new SanitizedEventName('inclusion stopped');
const event_ExclusionStarted = new SanitizedEventName('exclusion started');
const event_ExclusionFailed = new SanitizedEventName('exclusion failed');
const event_ExclusionStopped = new SanitizedEventName('exclusion stopped');
const event_NetworkHealDone = new SanitizedEventName('heal network done');
const event_FirmwareUpdateFinished = new SanitizedEventName('firmware update finished');
const event_ValueNotification = new SanitizedEventName('value notification');
const event_Notification = new SanitizedEventName('notification');
const event_ValueUpdated = new SanitizedEventName('value updated');
const event_ValueAdded = new SanitizedEventName('value added');
const event_Wake = new SanitizedEventName('wake up');
const event_Sleep = new SanitizedEventName('sleep');
const event_Dead = new SanitizedEventName('dead');
const event_Alive = new SanitizedEventName('alive');
const event_InterviewStarted = new SanitizedEventName('interview started');
const event_InterviewFailed = new SanitizedEventName('interview failed');
const event_InterviewCompleted = new SanitizedEventName('interview completed');
const event_Ready = new SanitizedEventName('ready');
const event_HealNetworkProgress = new SanitizedEventName('heal network progress');

module.exports = (RED: NodeAPI) => {
	const Init = function (this: TypeDriver, config: TypeDriverConfig) {
		const self = this;
		RED.nodes.createNode(self, config);

		let ControllerNodes: { [ControllerNodeID: string]: ControllerCallback } = {};
		let DeviceNodes: { [DeviceNodeID: string]: { NodeIDs: number[]; Callback: DeviceCallback } } = {};

		self.registerDeviceNode = (DeviceNodeID, NodeIDs, Callback) => {
			DeviceNodes[DeviceNodeID] = { NodeIDs, Callback };
		};
		self.deregisterDeviceNode = (DeviceNodeID) => {
			delete DeviceNodes[DeviceNodeID];
		};

		self.registerControllerNode = (ControllerNodeID, Callback) => {
			ControllerNodes[ControllerNodeID] = Callback;
		};
		self.deregisterControllerNode = (ControllerNodeID) => {
			delete ControllerNodes[ControllerNodeID];
		};

		self.on('close', (removed: boolean, done: () => void) => {
			if (removed) {
				ControllerNodes = {};
				DeviceNodes = {};
			}

			if (self.driverInstance) {
				self.driverInstance?.destroy().then(() => {
					self.driverInstance = undefined;
					done();
				});
			} else {
				done();
			}
		});

		const S2Void = (): void => {};

		const loggingEnabled = self.config.logConfig_level !== 'off';
		const loggingLevel = loggingEnabled ? self.config.logConfig_level : undefined;
		let nodeLogFilter: number[] | undefined;
		if (self.config.LogConfig_nodeFilter) {
			nodeLogFilter = self.config.LogConfig_nodeFilter.split(',').map((N) => parseInt(N.trim()));
		}
		const zwaveOptions = {
			logConfig: {
				enabled: loggingEnabled,
				logToFile: loggingEnabled,
				level: loggingLevel,
				nodeFilter: nodeLogFilter,
				filename: self.config.logConfig_filename
			},
			storage: {
				deviceConfigPriorityDir: self.config.storage_deviceConfigPriorityDir,
				throttle: self.config.storage_throttle
			},
			preferences: {
				scales: {
					temperature: self.config.preferences_scales_temperature,
					humidity: self.config.preferences_scales_humidity
				}
			},
			interview: {
				queryAllUserCodes: self.config.interview_queryAllUserCodes
			},
			securityKeys: {
				S0_Legacy: self.config.securityKeys_S0_Legacy
					? Buffer.from(self.config.securityKeys_S0_Legacy, 'hex')
					: undefined,
				S2_Unauthenticated: self.config.security_S2_Unauthenticated
					? Buffer.from(self.config.security_S2_Unauthenticated, 'hex')
					: undefined,
				S2_Authenticated: self.config.security_S2_Authenticated
					? Buffer.from(self.config.security_S2_Authenticated, 'hex')
					: undefined,
				S2_AccessControl: self.config.security_S2_AccessControl
					? Buffer.from(self.config.security_S2_AccessControl, 'hex')
					: undefined
			},
			apiKeys: {
				firmwareUpdateService: self.config.apiKeys_firmwareUpdateService
			},
			inclusionUserCallbacks: {
				grantSecurityClasses: undefined,
				validateDSKAndEnterPIN: undefined,
				abort: S2Void
			},
			disableOptimisticValueUpdate: self.config.disableOptimisticValueUpdate,
			enableSoftReset: self.config.enableSoftReset
		};

		self.driverInstance = new Driver(self.config.SerialPort, zwaveOptions);
	};

	RED.nodes.registerType('zwave-js-driver', Init);
};
