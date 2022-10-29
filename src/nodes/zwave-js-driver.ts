import { NodeAPI } from 'node-red';
import { TypeDriverConfig } from '../types/TypeDriverConfig';
import {
	TypeDriver,
	MessageType,
	DeviceCallback,
	ControllerCallback,
	ControllerCallbackObject,
	DeviceCallbackObject
} from '../types/TypeDriver';
import {
	Driver,
	InclusionGrant,
	// @ts-ignore
	ZWaveNode,
	HealNodeStatus,
	ZWaveNodeValueNotificationArgs,
	ZWaveNodeValueUpdatedArgs,
	NodeInterviewFailedEventArgs,
	ZWaveNodeValueAddedArgs
} from 'zwave-js';
const APP_NAME = 'node-red-contrib-zwave-js';
const APP_VERSION = '9.0.0';

// Event hook class
class SanitizedEventName {
	driverName: any;
	redEventName: string;
	nodeStatusName: string;
	statusNameWithNode: (Node: ZWaveNode) => string;

	constructor(event: string) {
		this.driverName = event;
		this.redEventName = event.replace(/ /g, '_').toUpperCase();
		this.nodeStatusName = event.charAt(0).toUpperCase() + event.substr(1).toLowerCase() + '.';
		this.statusNameWithNode = (Node) => {
			return `Node: ${Node.id} ${this.nodeStatusName}`;
		};
	}
}

// Update Service OS Key
const FWK = '127c49b6f2928a6579e82ecab64a83fc94a6436f03d5cb670b8ac44412687b75f0667843';

// Create event objects (creates easy to use event hooks)
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
//const event_FirmwareUpdateFinished = new SanitizedEventName('firmware update finished');
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

		// Controller and Device Nodes
		let ControllerNodes: { [ControllerNodeID: string]: ControllerCallback } = {};
		let DeviceNodes: { [DeviceNodeID: string]: { NodeIDs?: number[]; Callback: DeviceCallback } } = {};

		// Public methods (used by config clients)
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

		// Create HTTP API
		const CreateHTTPAPI = () => {
			RED.httpAdmin.get(`/zwave-js/${self.id}/nodes`, RED.auth.needsPermission('flows.write'), (_, response) => {
				response.json(self.driverInstance?.controller.nodes);
			});
		};

		// Remove HTTP API
		const RemoveHTTPAPI = () => {
			RED.httpNode._router.stack.forEach(function (route: any, i: number, routes: any[]) {
				if (route.route && route.route.path.startsWith(`/zwave-js/${self.id}`)) {
					routes.splice(i, 1);
				}
			});
		};

		// On close
		self.on('close', (_: boolean, done: () => void) => {
			RemoveHTTPAPI();
			ControllerNodes = {};
			DeviceNodes = {};
			if (self.driverInstance) {
				self.driverInstance?.destroy().then(() => {
					self.driverInstance = undefined;
					done();
				});
			} else {
				done();
			}
		});

		// S2 Callbacks
		const S2Void = (): void => {};
		const GrantSecurityClasses = (Request: InclusionGrant): Promise<InclusionGrant | false> => {
			return new Promise((resolve) => {
				resolve(Request);
			});
		};
		const ValidateDSKAndEnterPIN = (DSK: string): Promise<string | false> => {
			return new Promise((resolve) => {
				resolve(DSK);
			});
		};

		// Driver settings
		const loggingEnabled = self.config.logConfig_level !== 'off';
		const loggingLevel = loggingEnabled ? self.config.logConfig_level : undefined;
		let nodeLogFilter: number[] | undefined;
		if (self.config.LogConfig_nodeFilter) {
			nodeLogFilter = self.config.LogConfig_nodeFilter.split(',').map((N) => parseInt(N.trim()));
		}
		const ZWaveOptions = {
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
				firmwareUpdateService: self.config.apiKeys_firmwareUpdateService || FWK
			},
			inclusionUserCallbacks: {
				grantSecurityClasses: GrantSecurityClasses,
				validateDSKAndEnterPIN: ValidateDSKAndEnterPIN,
				abort: S2Void
			},
			disableOptimisticValueUpdate: self.config.disableOptimisticValueUpdate,
			enableSoftReset: self.config.enableSoftReset
		};

		// Driver callback subscriptions
		const WireDriverEvents = (): void => {
			// Driver ready
			self.driverInstance?.once(event_DriverReady.driverName, () => {
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'yellow',
						shape: 'dot',
						text: 'Initializing network...'
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Status);
				});
				WireSubDriverEvents();
				self.driverInstance?.controller.nodes.forEach((Node) => {
					WireNodeEvents(Node);
				});
			});
		};

		// Driver callback subscriptions that occure after driver ready
		const WireSubDriverEvents = () => {
			// Al Nodes Ready
			self.driverInstance?.on(event_AllNodesReady.driverName, () => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_AllNodesReady.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'green',
						shape: 'dot',
						text: event_AllNodesReady.nodeStatusName,
						clearTime: 5000
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
			});

			// Node Added
			self.driverInstance?.on(event_NodeAdded.driverName, (Node: ZWaveNode) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_NodeAdded.redEventName, timestamp: Timestamp, nodeId: Node.id }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'green',
						shape: 'dot',
						text: event_NodeAdded.statusNameWithNode(Node),
						clearTime: 5000
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
				WireNodeEvents(Node);
			});

			// Node Removed
			self.driverInstance?.on(event_NodeRemoved.driverName, (Node: ZWaveNode) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_NodeRemoved.redEventName, timestamp: Timestamp, nodeId: Node.id }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'green',
						shape: 'dot',
						text: event_NodeRemoved.statusNameWithNode(Node),
						clearTime: 5000
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
			});

			// inclusion started
			self.driverInstance?.on(event_InclusionStarted.driverName, (IsSecure: boolean) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Body = {
					isSecureInclude: IsSecure
				};
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_InclusionStarted.redEventName, timestamp: Timestamp, eventBody: Body }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'yellow',
						shape: 'dot',
						text: event_InclusionStarted.nodeStatusName
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
			});

			// inclusion failed
			self.driverInstance?.on(event_InclusionFailed.driverName, () => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_InclusionFailed.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'red',
						shape: 'dot',
						text: event_InclusionFailed.nodeStatusName,
						clearTime: 5000
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
			});

			// inclusion stopped
			self.driverInstance?.on(event_InclusionStopped.driverName, () => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_InclusionStopped.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'yellow',
						shape: 'ring',
						text: event_InclusionStopped.nodeStatusName,
						clearTime: 5000
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
			});

			// exclusion started
			self.driverInstance?.on(event_ExclusionStarted.driverName, () => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_ExclusionStarted.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'yellow',
						shape: 'dot',
						text: event_ExclusionStarted.nodeStatusName
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
			});

			// exclusion failed
			self.driverInstance?.on(event_ExclusionFailed.driverName, () => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_ExclusionFailed.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'red',
						shape: 'dot',
						text: event_ExclusionFailed.nodeStatusName,
						clearTime: 5000
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
			});

			// exclusion stopped
			self.driverInstance?.on(event_ExclusionStopped.driverName, () => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_ExclusionStopped.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'yellow',
						shape: 'ring',
						text: event_ExclusionStopped.nodeStatusName,
						clearTime: 5000
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
			});

			// Heal finnished
			self.driverInstance?.on(event_NetworkHealDone.driverName, (Result: ReadonlyMap<number, HealNodeStatus>) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_NetworkHealDone.redEventName, timestamp: Timestamp, eventBody: Result }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'green',
						shape: 'dot',
						text: event_NetworkHealDone.nodeStatusName,
						clearTime: 5000
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
			});

			// Heal Progress
			self.driverInstance?.on(event_HealNetworkProgress.driverName, (Progress: ReadonlyMap<number, HealNodeStatus>) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_HealNetworkProgress.redEventName, timestamp: Timestamp, eventBody: Progress }
				};
				const Count = Progress.size;
				const Remain = [...Progress.values()].filter((V) => V === 'pending').length;
				const Completed = Count - Remain;
				const CompletedPercentage = Math.round((100 * Completed) / (Completed + Remain));
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'yellow',
						shape: 'dot',
						text: `Heal network progress : ${CompletedPercentage}%`
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
			});
		};

		// Node callback subscriptions
		const WireNodeEvents = (Node: ZWaveNode) => {
			if (Node.isControllerNode) {
				return;
			}

			// Awake, Live, Dead, Sleep, Ready
			[event_Ready, event_Alive, event_Dead, event_Wake, event_Sleep].forEach((ThisEvent) => {
				Node.on(ThisEvent.driverName, (ThisNode: ZWaveNode) => {
					const Timestamp = new Date().getTime();
					const InterestedDeviceNodes = Object.values(DeviceNodes).filter(
						(I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined
					);
					const Event: DeviceCallbackObject = {
						Type: MessageType.EVENT,
						Event: {
							event: ThisEvent.redEventName,
							timestamp: Timestamp,
							nodeId: ThisNode.id,
							nodeName: ThisNode.name,
							nodeLocation: ThisNode.location
						}
					};
					InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
				});
			});

			// Interview Started
			Node.on(event_InterviewStarted.driverName, (ThisNode: ZWaveNode) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_NetworkHealDone.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'yellow',
						shape: 'dot',
						text: event_InterviewStarted.statusNameWithNode(ThisNode)
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
			});

			// Interview Completed
			Node.on(event_InterviewCompleted.driverName, (ThisNode: ZWaveNode) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_NetworkHealDone.redEventName, timestamp: Timestamp }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'green',
						shape: 'dot',
						text: event_InterviewCompleted.statusNameWithNode(ThisNode),
						clearTime: 5000
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
			});

			// Interview Failed
			Node.on(event_InterviewFailed.driverName, (ThisNode: ZWaveNode, Args: NodeInterviewFailedEventArgs) => {
				const Timestamp = new Date().getTime();
				const ControllerNodeIDs = Object.keys(ControllerNodes);
				const Event: ControllerCallbackObject = {
					Type: MessageType.EVENT,
					Event: { event: event_InterviewFailed.redEventName, timestamp: Timestamp, eventBody: Args }
				};
				const Status: ControllerCallbackObject = {
					Type: MessageType.STATUS,
					Status: {
						fill: 'red',
						shape: 'dot',
						text: event_InterviewFailed.statusNameWithNode(ThisNode),
						clearTime: 5000
					}
				};
				ControllerNodeIDs.forEach((ID) => {
					ControllerNodes[ID](Event);
					ControllerNodes[ID](Status);
				});
			});

			// Value Notification
			Node.on(event_ValueNotification.driverName, (ThisNode: ZWaveNode, Args: ZWaveNodeValueNotificationArgs) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(DeviceNodes).filter(
					(I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined
				);
				const Event: DeviceCallbackObject = {
					Type: MessageType.EVENT,
					Event: {
						event: event_ValueNotification.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: Args
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
			});

			// Value updated
			Node.on(event_ValueUpdated.driverName, (ThisNode: ZWaveNode, Args: ZWaveNodeValueUpdatedArgs) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(DeviceNodes).filter(
					(I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined
				);
				const Event: DeviceCallbackObject = {
					Type: MessageType.EVENT,
					Event: {
						event: event_ValueUpdated.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: Args
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
			});

			// Value Added
			Node.on(event_ValueAdded.driverName, (ThisNode: ZWaveNode, Args: ZWaveNodeValueAddedArgs) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(DeviceNodes).filter(
					(I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined
				);
				const Event: DeviceCallbackObject = {
					Type: MessageType.EVENT,
					Event: {
						event: event_ValueAdded.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: Args
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
			});

			// Notification
			Node.on(event_Notification.driverName, (ThisNode: ZWaveNode, CC: number, Args: Record<string, any>) => {
				const Timestamp = new Date().getTime();
				const InterestedDeviceNodes = Object.values(DeviceNodes).filter(
					(I) => I.NodeIDs?.includes(Node.id) || I.NodeIDs === undefined
				);
				const Event: DeviceCallbackObject = {
					Type: MessageType.EVENT,
					Event: {
						event: event_Notification.redEventName,
						timestamp: Timestamp,
						nodeId: ThisNode.id,
						nodeName: ThisNode.name,
						nodeLocation: ThisNode.location,
						eventBody: { ccId: CC, args: Args }
					}
				};
				InterestedDeviceNodes.forEach((Target) => Target.Callback(Event));
			});
		};

		try {
			self.driverInstance = new Driver(self.config.SerialPort, ZWaveOptions);
		} catch (err) {
			self.error(err);
			return;
		}

		if (self.config.enableStatistics) {
			self.driverInstance?.enableStatistics({
				applicationName: APP_NAME,
				applicationVersion: APP_VERSION
			});
		} else {
			self.driverInstance?.disableStatistics();
		}

		WireDriverEvents();
		self.driverInstance
			.start()
			.catch((e) => {
				self.error(e);
				return;
			})
			.then(() => {
				CreateHTTPAPI();
			});
	};

	RED.nodes.registerType('zwave-js-driver', Init);
};
