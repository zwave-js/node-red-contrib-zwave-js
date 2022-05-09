/* eslint-env jquery */
/* eslint-env browser */
/*eslint no-undef: "warn"*/
/*eslint no-unused-vars: "warn"*/

/* UI Inclusion Functions */
let StartInclusionExclusion;
let StartReplace;
let GrantSelected;
let ValidateDSK;
let GroupedNodes = true;

/* Just stuff */
let DriverReady = false;
const WindowSize = { w: 700, h: 600 };
let NetworkIdentifier = undefined;

/* Commands used throughout */
const DCs = {
	checkLifelineHealth: {
		API: 'DriverAPI',
		name: 'checkLifelineHealth',
		noWait: true
	},
	abortFirmwareUpdate: {
		API: 'ControllerAPI',
		name: 'abortFirmwareUpdate',
		noWait: false
	},
	addAssociations: {
		API: 'AssociationsAPI',
		name: 'addAssociations',
		noWait: false
	},
	removeAssociations: {
		API: 'AssociationsAPI',
		name: 'removeAssociations',
		noWait: false
	},
	getAssociations: {
		API: 'AssociationsAPI',
		name: 'getAssociations',
		noWait: false
	},
	getAllAssociationGroups: {
		API: 'AssociationsAPI',
		name: 'getAllAssociationGroups',
		noWait: false
	},
	getNodes: {
		API: 'ControllerAPI',
		name: 'getNodes',
		noWait: false
	},
	verifyDSK: {
		API: 'IEAPI',
		name: 'verifyDSK',
		noWait: false
	},
	grantClasses: {
		API: 'IEAPI',
		name: 'grantClasses',
		noWait: false
	},
	getNodeStatistics: {
		API: 'DriverAPI',
		name: 'getNodeStatistics',
		noWait: false
	},
	getControllerStatistics: {
		API: 'DriverAPI',
		name: 'getControllerStatistics',
		noWait: false
	},
	checkKeyReq: {
		API: 'IEAPI',
		name: 'checkKeyReq',
		noWait: false
	},
	replaceFailedNode: {
		API: 'IEAPI',
		name: 'replaceFailedNode',
		noWait: false
	},
	beginExclusion: {
		API: 'IEAPI',
		name: 'beginExclusion',
		noWait: false
	},
	beginInclusion: {
		API: 'IEAPI',
		name: 'beginInclusion',
		noWait: false
	},
	stopIE: {
		API: 'IEAPI',
		name: 'stopIE',
		noWait: false
	},
	commitScans: {
		API: 'IEAPI',
		name: 'commitScans',
		noWait: false
	},
	unprovisionSmartStartNode: {
		API: 'IEAPI',
		name: 'unprovisionSmartStartNode',
		noWait: false
	},
	unprovisionAllSmartStart: {
		API: 'IEAPI',
		name: 'unprovisionAllSmartStart',
		noWait: false
	},
	healNode: {
		API: 'ControllerAPI',
		name: 'healNode',
		noWait: true
	},
	beginHealingNetwork: {
		API: 'ControllerAPI',
		name: 'beginHealingNetwork',
		noWait: false
	},
	stopHealingNetwork: {
		API: 'ControllerAPI',
		name: 'stopHealingNetwork',
		noWait: false
	},
	hardReset: {
		API: 'ControllerAPI',
		name: 'hardReset',
		noWait: false
	},
	refreshInfo: {
		API: 'ControllerAPI',
		name: 'refreshInfo',
		noWait: true
	},
	removeFailedNode: {
		API: 'ControllerAPI',
		name: 'removeFailedNode',
		noWait: false
	},
	setNodeName: {
		API: 'ControllerAPI',
		name: 'setNodeName',
		noWait: false
	},
	setNodeLocation: {
		API: 'ControllerAPI',
		name: 'setNodeLocation',
		noWait: false
	},
	getDefinedValueIDs: {
		API: 'ValueAPI',
		name: 'getDefinedValueIDs',
		noWait: false
	},
	getValue: {
		API: 'ValueAPI',
		name: 'getValue',
		noWait: false
	},
	setValue: {
		API: 'ValueAPI',
		name: 'setValue',
		noWait: true
	},
	getValueMetadata: {
		API: 'ValueAPI',
		name: 'getValueMetadata',
		noWait: false
	}
};

let StepsAPI;
const StepList = {
	SecurityMode: 0,
	NIF: 1,
	Remove: 2,
	Classes: 3,
	DSK: 4,
	AddDone: 5,
	AddDoneInsecure: 6,
	RemoveDone: 7,
	ReplaceSecurityMode: 8,
	Aborted: 9,
	SmartStart: 10,
	SmartStartList: 11,
	SmartStartListEdit: 12,
	SmartStartDone: 13,
	RemoveDoneUnconfirmed: 14
};

const JSONFormatter = {};

JSONFormatter.json = {
	replacer: function (match, pIndent, pKey, pVal, pEnd) {
		var key = '<span class=json-key>';
		var val = '<span class=json-value>';
		var str = '<span class=json-string>';
		var r = pIndent || '';
		if (pKey) r = r + key + pKey + '</span>';
		if (pVal) r = r + (pVal[0] == '"' ? str : val) + pVal + '</span>';
		return r + (pEnd || '');
	},
	prettyPrint: function (obj) {
		var jsonLine = /^( *)("[\w]+": )?("[^"]*"|[\w.+-]*)?([,[{])?$/gm;
		return JSON.stringify(obj, null, 3)
			.replace(/&/g, '&amp;')
			.replace(/\\"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(jsonLine, JSONFormatter.json.replacer);
	}
};

const ZwaveJsUI = (function () {
	let HCForm; // Health Check Form
	let HCRounds; // Health Check Rounds
	let FirmwareForm; // FrimwareForm
	let FWRunning = false; // Firmware Updare Running
	const Groups = {}; // Association Groups
	let Removing = false; // Removing Failed Node
	let Timer; // Timers
	let IETime; // IE Time
	let SecurityTime; // Security Time
	const BatteryUIElements = {}; // Battery Icon Elements
	let BA = undefined; // Node Button Array
	let HoveredNode = undefined; // Hovered Node
	let selectedNode; // Selected Node
	let LastTargetForBA; // BA TArget

	function modalAlert(message, title) {
		const Buts = {
			Ok: function () {}
		};
		modalPrompt(message, title, Buts);
	}

	function modalPrompt(message, title, buttons, addCancel) {
		const Options = {
			draggable: false,
			modal: true,
			resizable: false,
			width: 'auto',
			title: title,
			minHeight: 75,
			buttons: {}
		};

		Object.keys(buttons).forEach((BT) => {
			Options.buttons[BT] = function () {
				$(this).dialog('destroy');
				buttons[BT]();
			};
		});

		if (addCancel) {
			Options.buttons['Cancel'] = function () {
				$(this).dialog('destroy');
			};
		}

		const D = $('<div>')
			.css({ padding: 10, maxWidth: 500, wordWrap: 'break-word' })
			.html(message)
			.dialog(Options);

		return D;
	}

	function ShowCommandViewer() {
		$('<div>')
			.css({ maxHeight: '80%' })
			.html('')
			.attr('id', 'CommandLog')
			.dialog({
				draggable: true,
				modal: false,
				resizable: true,
				width: WindowSize.w,
				height: WindowSize.h,
				title: 'UI Monitor',
				buttons: {
					Close: function () {
						$(this).dialog('destroy');
					},
					'Clear Log': function () {
						$('#CommandLog').empty();
					}
				}
			});
	}

	function processHealthCheckProgress(topic, data) {
		const P = Math.round((100 * data.payload) / HCRounds);
		HCForm.html(
			`<div style="width:430px; margin:auto;margin-top:40px;font-size:18px">Running Health Check. This may take a few minutes, please wait...</div><div class="progressbar"><div style="width:${P}%"></div></div>`
		);
	}
	function processHealthResults(topic, data) {
		const RatingsArray = data.payload.HealthCheck.results.map((R) => R.rating);

		const Min = Math.min(...RatingsArray);
		const Max = Math.max(...RatingsArray);
		const Average = Math.round(
			RatingsArray.reduce((a, b) => a + b, 0) / RatingsArray.length
		);

		const MC = Min < 4 ? 'red' : Min < 6 ? 'orange' : 'green';
		const AC = Average < 4 ? 'red' : Average < 6 ? 'orange' : 'green';
		const MXC = Max < 4 ? 'red' : Max < 6 ? 'orange' : 'green';

		const Data = {
			rounds: data.payload.HealthCheck.results,
			Worst: Min,
			Best: Max,
			Average: Average,
			MC: MC,
			AC: AC,
			MXC: MXC
		};

		Data.TX = data.payload.Statistics[HoveredNode.nodeId.toString()].commandsTX;
		Data.RX = data.payload.Statistics[HoveredNode.nodeId.toString()].commandsRX;
		Data.TXD =
			data.payload.Statistics[HoveredNode.nodeId.toString()].commandsDroppedTX;
		Data.RXD =
			data.payload.Statistics[HoveredNode.nodeId.toString()].commandsDroppedRX;
		Data.TO =
			data.payload.Statistics[HoveredNode.nodeId.toString()].timeoutResponse;

		HCForm.html('');
		const Template = $('#TPL_HealthCheck').html();
		const templateScript = Handlebars.compile(Template);
		const HTML = templateScript(Data);
		HCForm.append(HTML);

		RED.comms.unsubscribe(
			`/zwave-js/${NetworkIdentifier}/healthcheck`,
			processHealthResults
		);
		RED.comms.unsubscribe(
			`/zwave-js/${NetworkIdentifier}/healthcheckprogress`,
			processHealthCheckProgress
		);
	}

	function RenderHealthCheck(Rounds) {
		HCRounds = Rounds;

		ControllerCMD(
			DCs.checkLifelineHealth.API,
			DCs.checkLifelineHealth.name,
			undefined,
			[HoveredNode.nodeId, Rounds],
			DCs.checkLifelineHealth.noWait
		)
			.catch((err) => {
				modalAlert(err.responseText, 'Could not start Health Check.');
				throw new Error(err.responseText);
			})
			.then(() => {
				RED.comms.subscribe(
					`/zwave-js/${NetworkIdentifier}/healthcheck`,
					processHealthResults
				);
				RED.comms.subscribe(
					`/zwave-js/${NetworkIdentifier}/healthcheckprogress`,
					processHealthCheckProgress
				);

				const Options = {
					draggable: false,
					modal: true,
					resizable: false,
					width: WindowSize.w,
					height: WindowSize.h,
					title: 'Node Health Check : Node ' + HoveredNode.nodeId,
					minHeight: 75,
					buttons: {
						Cancel: function () {
							RED.comms.unsubscribe(
								`/zwave-js/${NetworkIdentifier}/healthcheck`,
								processHealthResults
							);
							RED.comms.unsubscribe(
								`/zwave-js/${NetworkIdentifier}/healthcheckprogress`,
								processHealthCheckProgress
							);
							$(this).dialog('destroy');
						}
					}
				};

				HCForm = $('<div>')
					.css({ padding: 10 })
					.html(
						`<div style="width:430px; margin:auto;margin-top:40px;font-size:18px">Running Health Check. This may take a few minutes, please wait...</div><div class="progressbar" style="width:70%;margin: auto; margin-top:50px"><div></div></div>`
					);

				HCForm.dialog(Options);
			});
	}

	function HealthCheck() {
		IsDriverReady();
		const Buttons = {
			'Yes (1 Round)': () => {
				RenderHealthCheck(1);
			},
			'Yes (3 Rounds)': () => {
				RenderHealthCheck(3);
			},
			'Yes (5 Rounds)': () => {
				RenderHealthCheck(5);
			}
		};
		modalPrompt(
			"A Node Health Check involves running diagnostics on a node and it's routing table, Care should be taken not to run this whilst large amounts of traffic is flowing through the network. Continue?",
			'Run Diagnostics?',
			Buttons,
			true
		);
	}

	function AbortUpdate() {
		if (FWRunning) {
			ControllerCMD(
				DCs.abortFirmwareUpdate.API,
				DCs.abortFirmwareUpdate.name,
				undefined,
				[selectedNode],
				DCs.abortFirmwareUpdate.noWait
			)
				.then(() => {
					FirmwareForm.dialog('destroy');
				})
				.catch((err) => {
					FirmwareForm.dialog('destroy');
					console.log(err.responseText);
				});
		} else {
			FirmwareForm.dialog('destroy');
		}
		FWRunning = false;
	}

	function PerformUpdate() {
		const FE = $('#FILE_FW')[0].files[0];
		const NID = parseInt($('#NODE_FW option:selected').val());
		const Target = $('#TARGET_FW').val();
		const Filename = FE.name;
		const Code = `${NID}:${Target}:${Filename}`;

		const reader = new FileReader();
		reader.onload = function () {
			const arrayBuffer = this.result;
			const array = new Uint8Array(arrayBuffer);
			const Options = {
				url: `zwave-js/${NetworkIdentifier}/firmwareupdate/${btoa(Code)}`,
				method: 'POST',
				contentType: 'application/octect-stream',
				data: array,
				processData: false
			};
			$.ajax(Options)
				.then(() => {
					FWRunning = true;
					selectNode(NID);
					$(":button:contains('Begin Update')")
						.prop('disabled', true)
						.addClass('ui-state-disabled');
					$('#FWProgress').css({ display: 'block' });
				})
				.catch((err) => {
					modalAlert(err.responseText, 'Firmware rejected');
				});
		};
		reader.readAsArrayBuffer(FE);
	}

	function FirmwareUpdate() {
		const Options = {
			draggable: false,
			modal: true,
			resizable: false,
			width: WindowSize.w,
			height: WindowSize.h,
			title: 'ZWave Device Firmware Updater',
			minHeight: 75,
			buttons: {
				'Begin Update': PerformUpdate,
				Cancel: function () {
					AbortUpdate();
					$(this).dialog('destroy');
				}
			}
		};

		FirmwareForm = $('<div>').css({ padding: 10 }).html('Please wait...');
		FirmwareForm.dialog(Options);

		$.getJSON(`zwave-js/${NetworkIdentifier}/cfg-nodelist`, (data) => {
			FirmwareForm.html('');
			const Template = $('#TPL_Firmware').html();
			const templateScript = Handlebars.compile(Template);
			const HTML = templateScript({ nodes: data });
			FirmwareForm.append(HTML);
			$('#FWProgress').css({ display: 'none' });
		});
	}

	function AddAssociation() {
		const NI = $('<input>')
			.attr('type', 'number')
			.attr('value', 1)
			.attr('min', 1);
		const EI = $('<input>')
			.attr('type', 'number')
			.attr('value', 0)
			.attr('min', 0);

		const Buttons = {
			Add: function () {
				const PL = [
					{
						nodeId: HoveredNode.nodeId,
						endpoint: parseInt($('#NODE_EP').val())
					},
					parseInt($('#NODE_G').val()),
					[{ nodeId: parseInt(NI.val()) }]
				];

				if (parseInt(EI.val()) > 0) {
					PL[2][0].endpoint = parseInt(EI.val());
				}

				const D = modalPrompt(
					'Adding Association...',
					'Please wait.',
					[],
					false
				);

				ControllerCMD(
					DCs.addAssociations.API,
					DCs.addAssociations.name,
					undefined,
					PL,
					DCs.addAssociations.noWait
				)
					.then(() => {
						D.dialog('destroy');
						GMGroupSelected();
					})
					.catch((err) => {
						D.dialog('destroy');
						if (err.status === 504) {
							modalAlert(
								'The device maybe in a sleeping state, the association will be added later.',
								'Association change could not be confirmed'
							);
						} else {
							modalAlert(err.responseText, 'Association could not be added.');
							throw new Error(err.responseText);
						}
					});
			}
		};

		const HTML = $('<div>').append('Node ID: ');
		NI.appendTo(HTML);
		HTML.append(' Endpoint: ');
		EI.appendTo(HTML);

		modalPrompt(HTML, 'New Association', Buttons, true);
	}

	function DeleteAssociation() {
		const Association = JSON.parse($(this).attr('data-address'));

		const PL = [
			{ nodeId: HoveredNode.nodeId, endpoint: parseInt($('#NODE_EP').val()) },
			parseInt($('#NODE_G').val()),
			[Association]
		];

		const Buttons = {
			Yes: function () {
				const D = modalPrompt(
					'Removing Association',
					'Please wait.',
					[],
					false
				);

				ControllerCMD(
					DCs.removeAssociations.API,
					DCs.removeAssociations.name,
					undefined,
					PL,
					DCs.removeAssociations.noWait
				)
					.then(() => {
						D.dialog('destroy');
						GMGroupSelected();
					})
					.catch((err) => {
						D.dialog('destroy');
						if (err.status === 504) {
							modalAlert(
								'The device maybe in a sleeping state, the association will be removed later.',
								'Association change could not be confirmed'
							);
						} else {
							modalAlert(err.responseText, 'Association could not be removed.');
							throw new Error(err.responseText);
						}
					});
			}
		};

		modalPrompt(
			'Are you sure you wish to remove this Association',
			'Remove Association',
			Buttons,
			true
		);
	}

	function GMEndPointSelected() {
		const Endpoint = $(event.target).val();
		const GroupIDs = Object.keys(Groups[Endpoint]);

		const GroupSelector = $('#NODE_G');
		GroupSelector.empty();
		$('<option>Select Group...</option>').appendTo(GroupSelector);

		GroupIDs.forEach((GID) => {
			const Group = Groups[Endpoint][GID];
			$(`<option value="${GID}">${GID} - ${Group.label}</option>`).appendTo(
				GroupSelector
			);
		});
	}

	function GMGroupSelected() {
		const Endpoint = parseInt($('#NODE_EP').val());
		const Group = parseInt($('#NODE_G').val());

		const AA = {
			nodeId: parseInt(HoveredNode.nodeId),
			endpoint: Endpoint
		};

		ControllerCMD(
			DCs.getAssociations.API,
			DCs.getAssociations.name,
			undefined,
			[AA],
			DCs.getAssociations.noWait
		)
			.then(({ object }) => {
				const Targets = object.Associations.filter((A) => A.GroupID === Group);

				$('#zwave-js-associations-table').find('tr:gt(0)').remove();

				// shoukd only be 1
				Targets.forEach((AG) => {
					AG.AssociationAddress.forEach((AD) => {
						const TR = $('<tr>');
						$('<td>').html(AD.nodeId).appendTo(TR);
						$('<td>')
							.html(AD.endpoint ?? '0 (Root Device)')
							.appendTo(TR);
						const TD3 = $('<td>').css({ textAlign: 'right' }).appendTo(TR);
						$('<input>')
							.attr('type', 'button')
							.addClass('ui-button ui-corner-all ui-widget')
							.attr('value', 'Delete')
							.attr('data-address', JSON.stringify(AD))
							.click(DeleteAssociation)
							.appendTo(TD3);

						$('#zwave-js-associations-table').append(TR);
					});
				});
			})
			.catch((err) => {
				modalAlert(err.responseText, 'Could not get associations.');
				throw new Error(err.responseText);
			});
	}

	function AssociationMGMT() {
		ControllerCMD(
			DCs.getAllAssociationGroups.API,
			DCs.getAllAssociationGroups.name,
			undefined,
			[HoveredNode.nodeId],
			DCs.getAllAssociationGroups.noWait
		)
			.then(({ object }) => {
				const Options = {
					draggable: false,
					modal: true,
					resizable: false,
					width: WindowSize.w,
					height: WindowSize.h,
					title: `ZWave Association Management: Node ${HoveredNode.nodeId}`,
					minHeight: 75,
					buttons: {
						Close: function () {
							$(this).dialog('destroy');
						}
					}
				};

				const Form = $('<div>')
					.css({ padding: 60, paddingTop: 30 })
					.html('Please wait...');
				Form.dialog(Options);

				const Template = $('#TPL_Associations').html();
				const templateScript = Handlebars.compile(Template);
				const HTML = templateScript({ endpoints: object });

				Form.html('');
				Form.append(HTML);

				$('#AMAddBTN').click(AddAssociation);

				$('#NODE_EP').change(GMEndPointSelected);
				$('#NODE_G').change(GMGroupSelected);

				object.forEach((EP) => {
					Groups[EP.Endpoint] = {};
					EP.Groups.forEach((AG) => {
						Groups[EP.Endpoint][AG.GroupID] = {
							label: AG.AssociationGroupInfo.label,
							maxNodes: AG.AssociationGroupInfo.maxNodes
						};
					});
				});
			})
			.catch((err) => {
				modalAlert(err.responseText, 'Could not get associtions.');
				throw new Error(err.responseText);
			});
	}

	async function GenerateMapJSON(Nodes) {
		return new Promise(function (res, rej) {
			ControllerCMD(
				DCs.getNodeStatistics.API,
				DCs.getNodeStatistics.name,
				undefined,
				undefined,
				DCs.getNodeStatistics.noWait
			)
				.then(({ object }) => {
					const _Nodes = [];

					Nodes.forEach((N) => {
						const _Node = {
							controller: N.isControllerNode,
							nodeId: N.nodeId,
							name: N.name,
							location: N.location,
							powerSource: N.powerSource,
							statistics: object[N.nodeId.toString()]
						};
						_Nodes.push(_Node);
					});

					ControllerCMD(
						DCs.getControllerStatistics.API,
						DCs.getControllerStatistics.name,
						undefined,
						undefined,
						DCs.getControllerStatistics.noWait
					)
						.then(({ object }) => {
							_Nodes.filter((_PC) => _PC.controller)[0].statistics = object;
							res(_Nodes);
						})
						.catch((err) => {
							rej(err.responseText);
						});
				})
				.catch((err) => {
					rej(err.responseText);
				});
		});
	}

	function NetworkMap() {
		ControllerCMD(
			DCs.getNodes.API,
			DCs.getNodes.name,
			undefined,
			undefined,
			DCs.getNodes.noWait
		)
			.then(({ object }) => {
				GenerateMapJSON(object)
					.then((Elements) => {
						localStorage.setItem('ZWJSMapData', JSON.stringify(Elements));
						window.open('zwave-js/mesh', '_blank');
					})
					.catch((err) => {
						modalAlert(err, 'Could not generate map.');
						throw new Error(err);
					});
			})
			.catch((err) => {
				modalAlert(err.responseText, 'Could not generate map.');
				throw new Error(err.responseText);
			});
	}

	let nodeOpts;

	function CheckDriverReady() {
		const Options = {
			url: `zwave-js/${NetworkIdentifier}/driverready`,
			method: 'GET'
		};

		return $.ajax(Options);
	}

	function IsNodeReady(Node) {
		if (!Node.ready) {
			modalAlert('This node is not ready', 'Node Not Ready');
			throw new Error('Node Not Ready');
		}
	}

	function IsDriverReady() {
		if (!DriverReady) {
			modalAlert(
				'The Controller has not yet been initialised.',
				'Controller Not Ready'
			);
			throw new Error('Driver Not Ready');
		}
	}

	function ControllerCMD(mode, method, node, params, dontwait) {
		IsDriverReady();
		const NoTimeoutFor = ['installConfigUpdate'];

		const Options = {
			url: `zwave-js/${NetworkIdentifier}/cmd`,
			method: 'POST',
			contentType: 'application/json'
		};

		const Payload = {
			mode: mode,
			method: method
		};
		if (node !== undefined) {
			Payload.node = node;
		}
		if (params !== undefined) {
			Payload.params = params;
		}
		if (dontwait !== undefined) {
			Payload.noWait = dontwait;
		}

		if (NoTimeoutFor.includes(method)) {
			Options.timeout = 0;
			Payload.noTimeout = true;
		} else {
			// Hopefully we will never have to depend on this, if so - there is something seriously wrong with the network, that the user should resolve.
			// Out internal timeouts of 10s will see to anything driver/server related
			Options.timeout = 30000;
		}

		if (mode !== 'IEAPI') {
			const Copy = JSON.parse(JSON.stringify({ payload: Payload }));
			delete Copy.payload.noTimeout;
			delete Copy.payload.noWait;

			const HTML = `${new Date().toString()}<hr /><pre class="MonitorEntry">${JSONFormatter.json.prettyPrint(
				Copy
			)}</pre><br />`;

			try {
				$('#CommandLog').append(HTML);
				$('#CommandLog').scrollTop($('#CommandLog')[0].scrollHeight);
				// eslint-disable-next-line no-empty
			} catch (err) {}
		} else {
			try {
				const HTML = `${new Date().toString()}<hr /><pre class="MonitorEntry">Include/Exclude commands are for the UI only.</pre><br />`;
				$('#CommandLog').append(HTML);
				$('#CommandLog').scrollTop($('#CommandLog')[0].scrollHeight);
				// eslint-disable-next-line no-empty
			} catch (err) {}
		}

		Options.data = JSON.stringify(Payload);
		return $.ajax(Options);
	}

	function AddNodeGroup(G) {
		const GP = $('<div>').css({
			height: '30px',
			lineHeight: '30px',
			paddingLeft: '15px',
			backgroundColor: 'lightgray',
			fontWeight: 'bold'
		});
		GP.attr('id', 'zwave-js-node-group-' + G.replace(/ /g, '-'));
		GP.html(G);
		$('#zwave-js-node-list').append(GP);
		return GP;
	}

	/* 
	  GetNodes is called for every node READY event,
	  so we better limit this as we will get a flood of these during start up
	*/
	let GNTimer = undefined;
	function GetNodesThrottled() {
		if (GNTimer !== undefined) {
			clearTimeout(GNTimer);
			GNTimer = undefined;
		}

		GNTimer = setTimeout(() => {
			GetNodes();
		}, 250);
	}

	function GetNodes() {
		BA = undefined;
		deselectCurrentNode();
		ControllerCMD(
			DCs.getNodes.API,
			DCs.getNodes.name,
			undefined,
			undefined,
			DCs.getNodes.noWait
		)
			.then(({ object }) => {
				const controllerNode = object.filter((N) => N.isControllerNode);
				if (controllerNode.length > 0) {
					makeInfo(
						'#zwave-js-controller-info',
						controllerNode[0].deviceConfig,
						controllerNode[0].firmwareVersion
					);
				}

				$('#zwave-js-node-list').empty();
				const Nodes = object.filter((node) => node && !node.isControllerNode);

				if (GroupedNodes) {
					let Groups = {};

					Nodes.forEach((N) => {
						if (N.location === undefined || N.location.length < 1) {
							if (!Groups.hasOwnProperty('No Location')) {
								Groups['No Location'] = [];
							}
							Groups['No Location'].push(renderNode(N));
						} else {
							if (!Groups.hasOwnProperty(N.location)) {
								Groups[N.location] = [];
							}
							Groups[N.location].push(renderNode(N));
						}
					});

					Groups = sortByKey(Groups);

					Object.keys(Groups).forEach((G) => {
						AddNodeGroup(G);
						Groups[G].forEach((NE) => {
							$('#zwave-js-node-list').append(NE);
						});
					});
				} else {
					Nodes.forEach((N) => $('#zwave-js-node-list').append(renderNode(N)));
				}

				$('#zwave-js-node-properties').treeList('empty');
			})
			.catch((err) => {
				modalAlert(err.responseText, 'Could not fetch nodes.');
				throw new Error(err.responseText);
			});
	}

	function sortByKey(obj) {
		const keys = Object.keys(obj);
		keys.sort();
		const sorted = {};
		for (let i = 0; i < keys.length; i++) {
			const key = keys[i];
			sorted[key] = obj[key];
		}
		return sorted;
	}

	function ListRequestedClass(Classes) {
		Classes.forEach((SC) => {
			$('tr#TR_' + SC).css({ opacity: 1.0 });
			$('input#SC_' + SC).prop('disabled', false);
		});

		StepsAPI.setStepIndex(StepList.Classes);
	}

	function DisplayDSK(DSK) {
		$('#DSK_Previw').html(DSK);
		StepsAPI.setStepIndex(StepList.DSK);
	}

	ValidateDSK = () => {
		const B = event.target;
		ControllerCMD(
			DCs.verifyDSK.API,
			DCs.verifyDSK.name,
			undefined,
			[$('#SC_DSK').val()],
			DCs.verifyDSK.noWait
		)
			.catch((err) => {
				modalAlert(err.responseText, 'Could not verify DSK.');
				throw new Error(err.responseText);
			})
			.then(() => {
				$(B).html('Please wait...');
				ClearIETimer();
				ClearSecurityCountDown();
				$(B).prop('disabled', true);
			});
	};

	GrantSelected = () => {
		const B = event.target;
		const Granted = [];
		$('.SecurityClassCB').each(function () {
			if ($(this).is(':checked')) {
				Granted.push(parseInt($(this).attr('id').replace('SC_', '')));
			}
		});
		ControllerCMD(
			DCs.grantClasses.API,
			DCs.grantClasses.name,
			undefined,
			[Granted],
			DCs.grantClasses.noWait
		)
			.catch((err) => {
				modalAlert(err.responseText, 'Could not grant Security Classes.');
				throw new Error(err.responseText);
			})
			.then(() => {
				$(B).html('Please wait...');
				ClearIETimer();
				ClearSecurityCountDown();
				$(B).prop('disabled', true);
			});
	};

	StartReplace = (Mode) => {
		const B = event.target;
		const OT = $(B).html();
		$(B).html('Please wait...');
		$(B).prop('disabled', true);

		const Request = {};
		switch (Mode) {
			case 'S2':
				Request.strategy = 4;
				break;

			case 'S0':
				Request.strategy = 3;
				break;

			case 'None':
				Request.strategy = 2;
				break;
		}

		ControllerCMD(
			DCs.checkKeyReq.API,
			DCs.checkKeyReq.name,
			undefined,
			[Request.strategy],
			DCs.checkKeyReq.noWait
		)
			.then(({ object }) => {
				if (object.ok) {
					ControllerCMD(
						DCs.replaceFailedNode.API,
						DCs.replaceFailedNode.name,
						undefined,
						[parseInt(HoveredNode.nodeId), Request],
						DCs.replaceFailedNode.noWait
					).catch((err) => {
						modalAlert(err.responseText, 'Could not replace Node.');
						$(B).html(OT);
						$(B).prop('disabled', false);
					});
				} else {
					modalAlert(object.message, 'Could not replace Node.');
					$(B).html(OT);
					$(B).prop('disabled', false);
				}
			})
			.catch((err) => {
				$(B).html(OT);
				$(B).prop('disabled', false);
				modalAlert(err.responseText, 'Could not replace Node.');
				throw new Error(err.responseText);
			});
	};

	StartInclusionExclusion = (Mode) => {
		const B = event.target;
		const OT = $(B).html();
		$(B).html('Please wait...');
		$(B).prop('disabled', true);

		const Request = {};
		const PreferS0 = $('#PS0').is(':checked');

		switch (Mode) {
			case 'Default':
				Request.strategy = 0;
				Request.forceSecurity = PreferS0;
				break;

			case 'EditSmartStart':
				StepsAPI.setStepIndex(StepList.SmartStartListEdit);
				$('#SSPurgeButton').css({ display: 'inline-block' });
				$.ajax({
					url: `zwave-js/${NetworkIdentifier}/smart-start-list`,
					method: 'GET',
					dataType: 'json',
					error: function (err) {
						modalAlert(err.responseText, 'Could not fetch Smart Start list.');
						throw new Error(err.responseText);
					},
					success: function (List) {
						List.forEach((Entry) => {
							const Item = $('<tr class="SmartStartEntry">');

							Item.append(`<td>${Entry.dsk.substring(0, 5)}</td>`);
							if (Entry.manufacturer === undefined) {
								Item.append(`<td>Unknown Manufacturer</td>`);
								Item.append(`<td>Unknown Product</td>`);
							} else {
								Item.append(`<td>${Entry.manufacturer}</td>`);
								Item.append(
									`<td>${Entry.label}<br /><span style="font-size:12px">${Entry.description}</span></td>`
								);
							}
							const BTNTD = $('<td>');
							BTNTD.css('text-align', 'right');
							const BTN = $('<button>');
							BTN.addClass('ui-button ui-corner-all ui-widget');
							BTN.html('Remove');
							BTN.click(() => {
								const Buttons = {
									Yes: function () {
										ControllerCMD(
											DCs.unprovisionSmartStartNode.API,
											DCs.unprovisionSmartStartNode.name,
											undefined,
											[Entry.dsk],
											DCs.unprovisionSmartStartNode.noWait
										)
											.then(() => {
												Item.remove();
											})
											.catch((err) => {
												modalAlert(
													err.responseText,
													'Could not remove Smart Start entry.'
												);
												throw new Error(err.responseText);
											});
									}
								};
								modalPrompt(
									'Are you sure you wish to remove this entry?',
									'Remove Smart Start Entry',
									Buttons,
									true
								);
							});
							BTN.appendTo(BTNTD);
							Item.append(BTNTD);
							$('#SmartStartEditList').append(Item);
						});
					}
				});
				return;

			case 'SmartStart':
				ControllerCMD(
					DCs.checkKeyReq.API,
					DCs.checkKeyReq.name,
					undefined,
					[1],
					DCs.checkKeyReq.noWait
				)
					.catch((err) => {
						$(B).html(OT);
						$(B).prop('disabled', false);
						modalAlert(err.responseText, 'Could not start Inclusion');
						throw new Error(err.responseText);
					})
					.then(({ object }) => {
						if (object.ok) {
							$('#SmartStartCommit').css({ display: 'inline' });
							$.ajax({
								url: `zwave-js/${NetworkIdentifier}/smartstart/startserver`,
								method: 'GET',
								error: function (err) {
									modalAlert(err.responseText, 'Could not start Inclusion');
									throw new Error(err.responseText);
								},
								success: function (QRData) {
									StepsAPI.setStepIndex(StepList.SmartStart);
									new QRCode($('#SmartStartQR')[0], {
										text: QRData,
										width: 150,
										height: 150,
										colorDark: '#000000',
										colorLight: '#ffffff',
										correctLevel: QRCode.CorrectLevel.L
									});

									$('#SmartStartURL').html(QRData);
								}
							});
						} else {
							$(B).html(OT);
							$(B).prop('disabled', false);
							modalAlert(object.message, 'Could not start Inclusion');
						}
					});

				return;

			case 'None':
				Request.strategy = 2;
				break;

			case 'S0':
				Request.strategy = 3;
				break;

			case 'S2':
				Request.strategy = 4;
				break;

			case 'Remove':
				ControllerCMD(
					DCs.beginExclusion.API,
					DCs.beginExclusion.name,
					undefined,
					[$('#ERP').is(':checked')],
					DCs.beginExclusion.noWait
				).catch((err) => {
					$(B).html(OT);
					$(B).prop('disabled', false);
					modalAlert(err.responseText, 'Could not start Exclusion');
					throw new Error(err.responseText);
				});
				return;
		}

		ControllerCMD(
			DCs.checkKeyReq.API,
			DCs.checkKeyReq.name,
			undefined,
			[Request.strategy],
			DCs.checkKeyReq.noWait
		)
			.then(({ object }) => {
				if (object.ok) {
					ControllerCMD(
						DCs.beginInclusion.API,
						DCs.beginInclusion.name,
						undefined,
						[Request],
						DCs.beginInclusion.noWait
					).catch((err) => {
						$(B).html(OT);
						$(B).prop('disabled', false);
						modalAlert(err.responseText, 'Could not start Inclusion');
						throw new Error(err.responseText);
					});
				} else {
					$(B).html(OT);
					$(B).prop('disabled', false);
					modalAlert(object.message, 'Could not start Inclusion');
				}
			})
			.catch((err) => {
				$(B).html(OT);
				$(B).prop('disabled', false);
				modalAlert(err.responseText, 'Could not start Inclusion');
				throw new Error(err.responseText);
			});
	};

	function ShowIncludeExcludePrompt() {
		const ParentDialog = $('<div>').css({ padding: 10 }).html('Please wait...');
		const Options = {
			draggable: false,
			modal: true,
			resizable: false,
			width: WindowSize.w,
			height: WindowSize.h,
			title: 'Node Inclusion/Exclusion',
			minHeight: 75,
			buttons: [
				{
					id: 'SSPurgeButton',
					text: 'Remove All',
					click: function () {
						const Buttons = {
							'Yes - Remove': function () {
								ControllerCMD(
									DCs.unprovisionAllSmartStart.API,
									DCs.unprovisionAllSmartStart.name,
									undefined,
									undefined,
									DCs.unprovisionAllSmartStart.noWait
								)
									.catch((err) => {
										ParentDialog.dialog('destroy');
										modalAlert(
											err.responseText,
											'Could not purge Smart Start entries'
										);
										throw new Error(err.responseText);
									})
									.then(() => {
										ParentDialog.dialog('destroy');
									});
							}
						};
						modalPrompt(
							'Are you sure you wish to remove all pre-provisioned device entries (the devices them self wont be removed)',
							'Purge Provisioning List',
							Buttons,
							true
						);
					}
				},
				{
					id: 'IEButton',
					text: 'Cancel',
					click: function () {
						$.ajax({
							url: `zwave-js/${NetworkIdentifier}/smartstart/stopserver`,
							method: 'GET'
						}).catch((err) => {
							console.log(err.responseText);
						});
						ClearIETimer();
						ClearSecurityCountDown();
						ControllerCMD(
							DCs.stopIE.API,
							DCs.stopIE.name,
							undefined,
							undefined,
							DCs.stopIE.noWait
						).catch((err) => {
							console.log(err.responseText);
						});
						ParentDialog.dialog('destroy');
					}
				},
				{
					id: 'SmartStartCommit',
					text: 'Commit Scans',
					click: function () {
						const SSEntries = $('.SmartStartEntry');
						const Entries = [];
						SSEntries.each(function (i, e) {
							Entries.push($(e).data('inclusionPackage'));
						});
						ControllerCMD(
							DCs.commitScans.API,
							DCs.commitScans.name,
							undefined,
							Entries,
							DCs.commitScans.noWait
						)
							.then(() => {
								StepsAPI.setStepIndex(StepList.SmartStartDone);
								$('#SmartStartCommit').css({ display: 'none' });
								$('#IEButton').css({ display: 'none' });
								$('#IEClose').css({ display: 'inline-block' });

								$.ajax({
									url: `zwave-js/${NetworkIdentifier}/smartstart/stopserver`,
									method: 'GET'
								}).catch((err) => {
									console.log(err.responseText);
								});
							})
							.catch((err) => {
								$.ajax({
									url: `zwave-js/${NetworkIdentifier}/smartstart/stopserver`,
									method: 'GET'
								}).catch((err) => {
									console.log(err.responseText);
								});
								modalAlert(
									err.responseText,
									'Could not commit Smart Start entries.'
								);
								throw new Error(err.responseText);
							});
					}
				},
				{
					id: 'IEClose',
					text: 'Ok',
					click: function () {
						ParentDialog.dialog('destroy');
					}
				}
			]
		};

		ParentDialog.dialog(Options);
		ParentDialog.html('');

		ParentDialog.append($('#TPL_Include').html());
		const Steps = $('#IncludeWizard').steps({ showFooterButtons: false });
		StepsAPI = Steps.data('plugin_Steps');

		$('#SmartStartCommit').css({ display: 'none' });
		$('#IEClose').css({ display: 'none' });
		$('#SSPurgeButton').css({ display: 'none' });
	}

	function ShowReplacePrompt() {
		const Options = {
			draggable: false,
			modal: true,
			resizable: false,
			width: WindowSize.w,
			height: WindowSize.h,
			title: 'Replace Node',
			minHeight: 75,
			buttons: [
				{
					id: 'IEButton',
					text: 'Cancel',
					click: function () {
						ControllerCMD(
							DCs.stopIE.API,
							DCs.stopIE.name,
							undefined,
							undefined,
							DCs.stopIE.noWait
						).catch((err) => {
							console.log(err.responseText);
						});
						$(this).dialog('destroy');
					}
				}
			]
		};

		const IncludeForm = $('<div>').css({ padding: 10 }).html('Please wait...');
		IncludeForm.dialog(Options);
		IncludeForm.html('');

		IncludeForm.append($('#TPL_Include').html());
		const Steps = $('#IncludeWizard').steps({ showFooterButtons: false });
		StepsAPI = Steps.data('plugin_Steps');
		StepsAPI.setStepIndex(StepList.ReplaceSecurityMode);
	}

	function StartNodeHeal() {
		ControllerCMD(
			DCs.healNode.API,
			DCs.healNode.name,
			undefined,
			[HoveredNode.nodeId],
			DCs.healNode.noWait
		).catch((err) => {
			modalAlert(err.responseText, 'Could not start Node heal.');
			throw new Error(err.responseText);
		});
	}

	function StartHeal() {
		ControllerCMD(
			DCs.beginHealingNetwork.API,
			DCs.beginHealingNetwork.name,
			undefined,
			undefined,
			DCs.beginHealingNetwork.noWait
		).catch((err) => {
			modalAlert(err.responseText, 'Could not start Network heal.');
			throw new Error(err.responseText);
		});
	}

	function StopHeal() {
		ControllerCMD(
			DCs.stopHealingNetwork.API,
			DCs.stopHealingNetwork.name,
			undefined,
			undefined,
			DCs.stopHealingNetwork.noWait
		).catch((err) => {
			console.log(err.responseText);
		});
	}

	function Reset() {
		const Buttons = {
			'Yes - Reset': function () {
				ControllerCMD(
					DCs.hardReset.API,
					DCs.hardReset.name,
					undefined,
					undefined,
					DCs.hardReset.noWait
				)
					.then(() => {
						modalAlert('Your Controller has been reset.', 'Reset Complete');
						GetNodes();
					})
					.catch((err) => {
						modalAlert(err.responseText, 'Could not reset the Controller.');
						throw new Error(err.responseText);
					});
			}
		};
		modalPrompt(
			'Are you sure you wish to reset your Controller? This action is irreversible, and will clear the Controllers data and configuration.',
			'Reset Controller',
			Buttons,
			true
		);
	}

	function InterviewNode() {
		ControllerCMD(
			DCs.refreshInfo.API,
			DCs.refreshInfo.name,
			undefined,
			[HoveredNode.nodeId],
			DCs.refreshInfo.noWait
		).catch((err) => {
			modalAlert(err.responseText, 'Could not interview the Node.');
			throw new Error(err.responseText);
		});
	}

	function OpenDB() {
		const info = HoveredNode.deviceConfig;

		const id = [
			'0x' + info.manufacturerId.toString(16).padStart(4, '0'),
			'0x' + info.devices[0].productType.toString(16).padStart(4, '0'),
			'0x' + info.devices[0].productId.toString(16).padStart(4, '0'),
			info.firmwareVersion.min
		].join(':');
		window.open(`https://devices.zwave-js.io/?jumpTo=${id}`, '_blank');
	}

	function RemoveFailedNode() {
		if (Removing) {
			modalAlert(
				'A node is already being removed, please allow a minute or 2.',
				'Could Not Remove Node'
			);
			return;
		}
		const Buttons = {
			'Yes - Remove': function () {
				const D = modalPrompt(
					'Checking if Node has failed...',
					'Please wait.',
					[],
					false
				);
				Removing = true;
				ControllerCMD(
					DCs.removeFailedNode.API,
					DCs.removeFailedNode.name,
					undefined,
					[HoveredNode.nodeId],
					DCs.removeFailedNode.noWait
				)
					.catch((err) => {
						D.dialog('destroy');
						modalAlert(err.responseText, 'Could not remove the Node.');
						Removing = false;
					})
					.then(() => {
						D.dialog('destroy');
						Removing = false;
					});
			}
		};
		modalPrompt(
			'Are you sure you wish to remove this node?',
			'Remove Failed Node',
			Buttons,
			true
		);
	}

	function ShowOtherControllolerMenu(button) {
		const menuOptionMenu = RED.menu.init({
			id: 'controller-option-menu',
			options: [
				{
					id: 'controller-option-menu-refresh',
					label: 'Refresh Node List',
					onselect: function () {
						IsDriverReady();
						GetNodes();
					}
				},
				{
					id: 'controller-option-menu-start-heal',
					label: 'Begin Network Heal',
					onselect: function () {
						IsDriverReady();
						StartHeal();
					}
				},
				{
					id: 'controller-option-menu-stop-heal',
					label: 'Stop Network Heal',
					onselect: function () {
						IsDriverReady();
						StopHeal();
					}
				},
				{
					id: 'controller-option-menu-firmware',
					label: 'Node Firmware Updater',
					onselect: function () {
						IsDriverReady();
						FirmwareUpdate();
					}
				},
				{
					id: 'controller-option-menu-reset',
					label: 'Reset Controller',
					onselect: function () {
						Reset();
					}
				}
			]
		});
		menuOptionMenu.css({
			position: 'absolute'
		});
		menuOptionMenu.on('mouseleave', function () {
			$(this).hide();
		});
		menuOptionMenu.on('mouseup', function () {
			$(this).hide();
		});
		menuOptionMenu.appendTo('body');

		const elementPos = button.offset();
		menuOptionMenu.css({
			top: elementPos.top + 'px',
			left: elementPos.left - menuOptionMenu.width() + 20 + 'px'
		});
		menuOptionMenu.show();
	}

	function AttachToNetwork(Network) {
		$('#zwave-js-controller-info').html('Loading Network...');
		$('#zwave-js-controller-status').html('Loading Network...');

		if (NetworkIdentifier !== undefined) {
			RED.comms.unsubscribe(
				`/zwave-js/${NetworkIdentifier}/cmd`,
				handleControllerEvent
			);
			RED.comms.unsubscribe(
				`/zwave-js/${NetworkIdentifier}/battery`,
				handleBattery
			);
			RED.comms.unsubscribe(
				`/zwave-js/${NetworkIdentifier}/status`,
				handleStatusUpdate
			);
			deselectCurrentNode();
		}

		DriverReady = false;
		NetworkIdentifier = Network;

		RED.comms.subscribe(
			`/zwave-js/${NetworkIdentifier}/cmd`,
			handleControllerEvent
		);
		RED.comms.subscribe(
			`/zwave-js/${NetworkIdentifier}/battery`,
			handleBattery
		);
		RED.comms.subscribe(
			`/zwave-js/${NetworkIdentifier}/status`,
			handleStatusUpdate
		);

		setTimeout(WaitLoad, 100);
		$('#zwave-js-current-net-id').html(NetworkIdentifier);
	}

	function init() {
		// Container(s)
		const content = $('<div>').addClass('red-ui-sidebar-info').css({
			position: 'relative',
			height: '100%',
			overflowY: 'hidden',
			display: 'flex',
			flexDirection: 'column'
		});
		const stackContainer = $('<div>')
			.addClass('red-ui-sidebar-info-stack')
			.appendTo(content);

		// Main Panel
		const mainPanel = $('<div>')
			.css({ overflow: 'hidden', display: 'flex', flexDirection: 'column' })
			.appendTo(stackContainer);

		/* ---------- Controller Section ---------- */

		// Controller Header
		const controllerHeader = $('<div>')
			.addClass('red-ui-sidebar-header')
			.css({ flex: '0 0 auto', textAlign: 'left', padding: 5 })
			.appendTo(mainPanel);

		// Controller, Network Data
		const ControllerHeaderTable = $('<table>');
		ControllerHeaderTable.appendTo(controllerHeader);
		ControllerHeaderTable.addClass('zwave-js-header-table');

		const CTTR1 = $('<tr>');
		CTTR1.appendTo(ControllerHeaderTable);
		const CTTD1 = $('<td>');
		CTTD1.appendTo(CTTR1);
		$('<div>')
			.addClass('zwave-js-id-box')
			.attr('id', 'zwave-js-current-net-id')
			.css({ cursor: 'pointer' })
			.html('--')
			.click(() => {
				$.getJSON(`zwave-js/cfg-getids`, (data) => {
					if (data.UsedNIDs.length > 0) {
						if (NetworkIdentifier === undefined) {
							AttachToNetwork(data.UsedNIDs[0]);
						} else {
							let StartID = NetworkIdentifier + 1;
							if (StartID === 5) StartID = 1;
							while (!data.UsedNIDs.includes(StartID)) {
								StartID++;
								if (StartID === 5) StartID = 1;
							}
							AttachToNetwork(StartID);
						}
					} else {
						modalAlert(
							'No networks could be found. Ensure you have a configured controller node in your flow.',
							'Attach to network'
						);
					}
				});
			})
			.appendTo(CTTD1);
		const CTTD2 = $('<td>');
		CTTD2.appendTo(CTTR1);
		$('<div id="zwave-js-controller-info">')
			.css({ fontWeight: 'bold' })
			.html('No Network Selected')
			.appendTo(CTTD2);

		$('<div id="zwave-js-controller-status">')
			.html('No Network Selected')
			.appendTo(CTTD2);

		const CTTR2 = $('<tr>');
		CTTR2.appendTo(ControllerHeaderTable);
		const CTTD3 = $('<td colspan="2">');
		CTTD3.css({ width: '100%' });
		CTTD3.appendTo(CTTR2);

		const BA = $('<div>');
		BA.css({
			width: '100%',
			paddingTop: '5px'
		});
		BA.appendTo(CTTD3);

		// Group
		const Group = $('<button>');
		Group.click(() => {
			IsDriverReady();
			if (GroupedNodes) {
				GroupedNodes = false;
				Group.find('i').removeClass('fa-indent');
				Group.find('i').addClass('fa-list');
			} else {
				GroupedNodes = true;
				Group.find('i').removeClass('fa-list');
				Group.find('i').addClass('fa-indent');
			}
			GetNodes();
		});
		Group.addClass('red-ui-button red-ui-button-small zwave-js-round-square');
		Group.css({ width: '30px', height: '30px', marginRight: '1px' });
		Group.append('<i class="fa fa-indent fa-lg"></i>');
		RED.popover.tooltip(Group, 'Toggle Node Grouping');
		BA.append(Group);

		// Include Exclude
		const IE = $('<button>');
		IE.click(() => {
			IsDriverReady();
			ShowIncludeExcludePrompt();
		});
		IE.addClass('red-ui-button red-ui-button-small zwave-js-round-square');
		IE.css({ width: '30px', height: '30px', marginRight: '1px' });
		IE.append('<i class="fa fa-handshake-o fa-lg"></i>');
		RED.popover.tooltip(IE, 'Include/Exclude');
		BA.append(IE);

		// Map
		const Heal = $('<button>');
		Heal.click(() => {
			IsDriverReady();
			NetworkMap();
		});
		Heal.addClass('red-ui-button red-ui-button-small zwave-js-round-square');
		Heal.css({ width: '30px', height: '30px', marginRight: '1px' });
		Heal.append('<i class="fa fa-globe fa-lg"></i>');
		RED.popover.tooltip(Heal, 'Network Map');
		BA.append(Heal);

		// Monitor
		const Monitor = $('<button>');
		Monitor.click(() => {
			ShowCommandViewer();
		});
		Monitor.addClass('red-ui-button red-ui-button-small zwave-js-round-square');
		Monitor.css({ width: '30px', height: '30px', marginRight: '1px' });
		Monitor.append('<i class="fa fa-bug fa-lg"></i>');
		RED.popover.tooltip(Monitor, 'UI Command Monitor');
		BA.append(Monitor);

		// Other
		const OtherBTN = $('<button>');
		OtherBTN.click(() => {
			ShowOtherControllolerMenu(OtherBTN);
		});
		OtherBTN.addClass(
			'red-ui-button red-ui-button-small zwave-js-round-square'
		);
		OtherBTN.css({ width: '30px', height: '30px', marginRight: '1px' });
		OtherBTN.append('<i class="fa fa-caret-down fa-lg"></i>');
		RED.popover.tooltip(OtherBTN, 'Other Actions');
		BA.append(OtherBTN);

		// Node List
		$('<div id="zwave-js-node-list">')
			.css({
				flex: '1 1 auto',
				display: 'flex',
				flexDirection: 'column',
				overflowY: 'auto'
			})
			.appendTo(mainPanel);

		/* ---------- Node Section ---------- */

		// Node Panel
		const nodePanel = $('<div>')
			.css({ overflow: 'hidden', display: 'flex', flexDirection: 'column' })
			.appendTo(stackContainer);

		// Node Header
		const nodeHeader = $('<div>')
			.addClass('red-ui-sidebar-header')
			.css({ flex: '0 0', textAlign: 'left', padding: 5 })
			.appendTo(mainPanel);

		// Node, Network Data
		const NodeHeaderTable = $('<table>');
		NodeHeaderTable.appendTo(nodeHeader);
		NodeHeaderTable.addClass('zwave-js-header-table');

		const NDTR1 = $('<tr>');
		NDTR1.appendTo(NodeHeaderTable);
		const NDTD1 = $('<td>');
		NDTD1.appendTo(NDTR1);
		$('<div>')
			.addClass('zwave-js-id-box')
			.attr('id', 'zwave-js-current-node-id')
			.css({ cursor: 'pointer' })
			.html('--')
			.appendTo(NDTD1);
		const NDTD2 = $('<td>');
		NDTD2.appendTo(NDTR1);
		$('<div id="zwave-js-selected-node-info">')
			.css({ fontWeight: 'bold' })
			.html('No Node Selected')
			.appendTo(NDTD2);

		$('<div id="zwave-js-selected-node-name">')
			.html('No Node Selected')
			.appendTo(NDTD2);

		const NDTR2 = $('<tr>');
		NDTR2.appendTo(NodeHeaderTable);
		const NDTD3 = $('<td colspan="2">');
		NDTD3.css({ width: '100%' });
		NDTD3.appendTo(NDTR2);

		nodeOpts = $('<div>').appendTo(nodeHeader); //.hide();

		// Endpoint Filter
		$('<div id="zwave-js-node-endpoint-filter">').appendTo(nodeOpts);

		// Node Proeprties List
		$('<div id="zwave-js-node-properties">')
			.css({ width: '100%', height: '100%' })
			.appendTo(nodePanel)
			.treeList({ data: [] });

		// Build stack
		const panels = RED.panels.create({ container: stackContainer });
		panels.ratio(0.5);

		const resizeStack = () => panels.resize(content.height());
		RED.events.on('sidebar:resize', resizeStack);
		$(window).on('resize', resizeStack);
		$(window).on('focus', resizeStack);

		// Add tab
		RED.sidebar.addTab({
			id: 'zwave-js',
			label: ' ZWave JS',
			name: 'Z-Wave JS',
			content,
			enableOnEdit: true,
			iconClass: 'fa fa-feed',
			onchange: () => setTimeout(resizeStack, 0) // Only way I can figure out how to init the resize when tab becomes visible
		});

		// Load First Network (if any)
		$.getJSON(`zwave-js/cfg-getids`, (data) => {
			if (data.UsedNIDs.length > 0) {
				AttachToNetwork(data.UsedNIDs[0]);
			}
		});
	}
	// Init done

	function WaitLoad() {
		CheckDriverReady().then(({ ready }) => {
			if (ready) {
				DriverReady = true;
				getLatestStatus();
				GetNodes();
			} else {
				setTimeout(WaitLoad, 3000);
			}
		});
	}

	function handleStatusUpdate(topic, data) {
		$('#zwave-js-controller-status').html(data.status);
	}

	let RemovedShown = false;
	function handleControllerEvent(topic, data) {
		switch (data.type) {
			case 'node-collection-change':
				if (data.event === 'node added') {
					ClearIETimer();
					ClearSecurityCountDown();
					GetNodes();
					if (
						data.inclusionResult.lowSecurity !== undefined &&
						data.inclusionResult.lowSecurity
					) {
						StepsAPI.setStepIndex(StepList.AddDoneInsecure);
					} else {
						StepsAPI.setStepIndex(StepList.AddDone);
					}
					$('#IEButton').text('Close');
				}
				if (data.event === 'node removed') {
					RemovedShown = true;
					ClearIETimer();
					ClearSecurityCountDown();
					GetNodes();
					selectedNode = undefined;
					StepsAPI.setStepIndex(StepList.RemoveDone);
					$('#IEButton').text('Close');
				}
				break;

			case 'node-inclusion-step':
				if (data.event === 'grant security') {
					$('#IEButton').text('Abort S2 Bootstrap');
					ListRequestedClass(data.classes);
					ClearIETimer();
					StartSecurityCountDown();
				}
				if (data.event === 'verify dsk') {
					$('#IEButton').text('Abort S2 Bootstrap');
					DisplayDSK(data.dsk);
					ClearIETimer();
					StartSecurityCountDown();
				}
				if (data.event === 'inclusion started') {
					StepsAPI.setStepIndex(StepList.NIF);
					StartIECountDown();
				}
				if (data.event === 'exclusion started') {
					StepsAPI.setStepIndex(StepList.Remove);
					StartIECountDown();
					RemovedShown = false;
				}
				if (data.event === 'exclusion stopped') {
					if (!RemovedShown) {
						ClearIETimer();
						ClearSecurityCountDown();
						StepsAPI.setStepIndex(StepList.RemoveDoneUnconfirmed);
						$('#IEButton').text('Close');
					}
				}
				if (data.event === 'aborted') {
					StepsAPI.setStepIndex(StepList.Aborted);
					ClearIETimer();
					ClearSecurityCountDown();
				}
				if (data.event === 'smart start awaiting codes') {
					// New List
					StepsAPI.setStepIndex(StepList.SmartStartList);
				}
				if (data.event === 'smart start code received') {
					// Append List
					const Item = $('<tr class="SmartStartEntry">');

					Item.append(`<td>${data.data.humaReadable.dsk}</td>`);
					if (data.data.humaReadable.manufacturer === undefined) {
						Item.append(`<td>Unknown Manufacturer</td>`);
						Item.append(`<td>Unknown Product</td>`);
					} else {
						Item.append(`<td>${data.data.humaReadable.manufacturer}</td>`);
						Item.append(
							`<td>${data.data.humaReadable.label}<br /><span style="font-size:12px">${data.data.humaReadable.description}</span></td>`
						);
					}
					const BTNTD = $('<td>');
					BTNTD.css('text-align', 'right');
					const BTN = $('<button>');
					BTN.addClass('ui-button ui-corner-all ui-widget');
					BTN.html('Remove');
					BTN.click(() => {
						Item.remove();
					});
					BTN.appendTo(BTNTD);
					Item.append(BTNTD);
					$('#SmartStartScannedList').append(Item);
					Item.data('inclusionPackage', data.data.inclusionPackage);
				}
				break;

			case 'node-status':
				const nodeRow = $('#zwave-js-node-list').find(
					`[data-nodeid='${data.node}']`
				);
				if (data.status == 'READY') {
					if (DriverReady) {
						GetNodesThrottled();
					}
				} else {
					nodeRow
						.find('.zwave-js-node-row-status')
						.html(renderStatusIcon(data.status.toUpperCase()));
				}
				break;
		}
	}

	function ClearIETimer() {
		if (Timer !== undefined) {
			clearInterval(Timer);
			Timer = undefined;
		}
	}
	function StartIECountDown() {
		ClearIETimer();
		IETime = 30;
		Timer = setInterval(() => {
			IETime--;
			$('.countdown').html(IETime + ' seconds remaining...');
			if (IETime <= 0) {
				ClearIETimer();
				$('#IEButton').click();
			}
		}, 1000);
	}
	function ClearSecurityCountDown() {
		if (Timer !== undefined) {
			clearInterval(Timer);
			Timer = undefined;
		}
	}
	function StartSecurityCountDown() {
		ClearSecurityCountDown();
		SecurityTime = 240;
		Timer = setInterval(() => {
			SecurityTime--;
			$('.countdown').html(SecurityTime + ' seconds remaining...');
			if (SecurityTime <= 0) {
				ClearSecurityCountDown();
			}
		}, 1000);
	}

	function renderBattery(node) {
		const i = $('<i>');

		if (node.interviewStage === 'Complete') {
			switch (node.powerSource.type) {
				case 'mains':
					i.addClass('fa fa-plug');
					BatteryUIElements[node.nodeId] = RED.popover.tooltip(
						i,
						'Mains Powered'
					);
					break;

				default:
					let Class;
					node.powerSource.level > 90
						? (Class = 'fa fa-battery-full')
						: node.powerSource.level > 65
						? (Class = 'fa fa-battery-three-quarters')
						: node.powerSource.level > 35
						? (Class = 'fa fa-battery-half')
						: node.powerSource.level > 10
						? (Class = 'fa fa-battery-quarter')
						: (Class = 'fa fa-battery-empty');

					if (node.powerSource.isLow) {
						i.css({ color: 'red' });
					}
					i.addClass(Class);
					BatteryUIElements[node.nodeId] = RED.popover.tooltip(
						i,
						'Level: ' + node.powerSource.level
					);
			}
		} else {
			i.addClass('fa fa-hourglass');
			BatteryUIElements[node.nodeId] = RED.popover.tooltip(
				i,
				'Power Source not yet known'
			);
		}
		return i;
	}

	function renderLock(node) {
		const L = $('<span>');
		L.addClass('fa-stack');
		if (node.highestSecurityClass !== undefined) {
			switch (node.highestSecurityClass) {
				case 0:
					L.append('<span class="fa fa-lock fa-stack-2x"></span>');
					L.append(
						'<strong class="fa-stack-1x" style="font-size:80%; color:white; margin-top:4px">S2</strong>'
					);
					RED.popover.tooltip(L, 'S2 | Unauthenticated');
					break;
				case 1:
					L.append('<span class="fa fa-lock fa-stack-2x"></span>');
					L.append(
						'<strong class="fa-stack-1x" style="font-size:80%; color:white; margin-top:4px">S2</strong>'
					);
					RED.popover.tooltip(L, 'S2 | Authenticated');
					break;
				case 2:
					L.append('<span class="fa fa-lock fa-stack-2x"></span>');
					L.append(
						'<strong class="fa-stack-1x" style="font-size:80%; color:white; margin-top:4px">S2</strong>'
					);
					RED.popover.tooltip(L, 'S2 | Access Control');
					break;

				case 7:
					L.append('<span class="fa fa-lock fa-stack-2x"></span>');
					L.append(
						'<strong class="fa-stack-1x" style="font-size:80%; color:white; margin-top:4px">S0</strong>'
					);
					RED.popover.tooltip(L, 'S0 | Legacy');
					break;

				default:
					L.append('<span class="fa fa-unlock-alt fa-stack-2x"></span>');
					RED.popover.tooltip(L, 'No Security!');
					break;
			}
		} else {
			L.append('<span class="fa fa-unlock-alt fa-stack-2x"></span>');
			RED.popover.tooltip(L, 'No Security!');
		}

		return L;
	}

	function NameNode() {
		const NN = $('<input>')
			.attr('type', 'text')
			.attr('value', HoveredNode.name);
		const NL = $('<input>')
			.attr('type', 'text')
			.attr('value', HoveredNode.location);

		const Buttons = {
			Save: function () {
				const Name = NN.val();
				const Location = NL.val();

				ControllerCMD(
					DCs.setNodeName.API,
					DCs.setNodeName.name,
					undefined,
					[HoveredNode.nodeId, Name],
					DCs.setNodeName.noWait
				)
					.then(() => {
						ControllerCMD(
							DCs.setNodeLocation.API,
							DCs.setNodeLocation.name,
							undefined,
							[HoveredNode.nodeId, Location],
							DCs.setNodeLocation.noWait
						)
							.then(() => {
								$(`.zwave-js-node-row[data-nodeid='${HoveredNode.nodeId}']`)
									.find('.zwave-js-node-row-name')
									.text(Name);
								if (HoveredNode.nodeId == selectedNode) {
									let Lable = `${HoveredNode.nodeId} - ${Name}`;
									if (Location.length > 0) Lable += ` (${Location})`;
									$('#zwave-js-selected-node-name').text(Lable);
								}
								HoveredNode.name = Name;
								HoveredNode.location = Location;
							})
							.catch((err) => {
								modalAlert(
									err.responseText,
									'Could not set Node name and /or location.'
								);
								throw new Error(err.responseText);
							});
					})
					.catch((err) => {
						modalAlert(
							err.responseText,
							'Could not set Node name and /or location.'
						);
						throw new Error(err.responseText);
					});
			}
		};

		const HTML = $('<div>').append('Name: ');
		NN.appendTo(HTML);
		HTML.append(' Location: ');
		NL.appendTo(HTML);

		modalPrompt(HTML, 'Set Node Name & Location', Buttons, true);
	}

	function AddOverlayNodeButtons(Node, Row) {
		HoveredNode = Node;

		Row.children().css({ display: 'none' });
		Row.children().first().css({ display: 'block' });
		Row.css({ height: '30px' });

		if (BA === undefined) {
			BA = $('<div>');
			BA.css({
				position: 'relative',
				left: '-1px',
				backgroundColor: 'inherit'
			});

			const NameLocation = $('<button>');
			NameLocation.click(() => {
				event.stopPropagation();
				IsNodeReady(HoveredNode);
				NameNode();
			});
			NameLocation.addClass(
				'red-ui-button red-ui-button-small zwave-js-round-square'
			);
			NameLocation.css({
				width: '30px',
				height: '30px',
				marginRight: '1px'
			});
			NameLocation.append('<i class="fa fa-pencil fa-lg"></i>');
			RED.popover.tooltip(NameLocation, 'Edit Name / Location');
			BA.append(NameLocation);

			const _HealthCheck = $('<button>');
			_HealthCheck.click(() => {
				event.stopPropagation();
				IsNodeReady(HoveredNode);
				HealthCheck();
			});
			_HealthCheck.addClass(
				'red-ui-button red-ui-button-small zwave-js-round-square'
			);
			_HealthCheck.css({
				width: '30px',
				height: '30px',
				marginRight: '1px'
			});
			_HealthCheck.append('<i class="fa fa-stethoscope fa-lg"></i>');
			RED.popover.tooltip(_HealthCheck, 'Run Health Check');
			BA.append(_HealthCheck);

			const Heal = $('<button>');
			Heal.click(() => {
				event.stopPropagation();
				IsNodeReady(HoveredNode);
				StartNodeHeal();
			});
			Heal.addClass('red-ui-button red-ui-button-small zwave-js-round-square');
			Heal.css({
				width: '30px',
				height: '30px',
				marginRight: '1px'
			});
			Heal.append('<i class="fa fa-medkit fa-lg"></i>');
			RED.popover.tooltip(Heal, 'Heal Node');
			BA.append(Heal);

			const Associations = $('<button>');
			Associations.click(() => {
				event.stopPropagation();
				IsNodeReady(HoveredNode);
				AssociationMGMT();
			});
			Associations.addClass(
				'red-ui-button red-ui-button-small zwave-js-round-square'
			);
			Associations.css({
				width: '30px',
				height: '30px',
				marginRight: '1px'
			});
			Associations.append('<i class="fa fa-code-fork fa-lg"></i>');
			RED.popover.tooltip(Associations, 'Association Management');
			BA.append(Associations);

			const Interview = $('<button>');
			Interview.click(() => {
				event.stopPropagation();
				IsNodeReady(HoveredNode);
				InterviewNode();
			});
			Interview.addClass(
				'red-ui-button red-ui-button-small zwave-js-round-square'
			);
			Interview.css({
				width: '30px',
				height: '30px',
				marginRight: '1px'
			});
			Interview.append('<i class="fa fa-handshake-o fa-lg"></i>');
			RED.popover.tooltip(Interview, 'Re-Interview Node');
			BA.append(Interview);

			const RemoveFailed = $('<button>');
			RemoveFailed.click(() => {
				event.stopPropagation();
				RemoveFailedNode();
			});
			RemoveFailed.addClass(
				'red-ui-button red-ui-button-small zwave-js-round-square'
			);
			RemoveFailed.css({
				width: '30px',
				height: '30px',
				marginRight: '1px'
			});
			RemoveFailed.append('<i class="fa  fa-trash-o fa-lg"></i>');
			RED.popover.tooltip(RemoveFailed, 'Remove Failed Node');
			BA.append(RemoveFailed);

			const ReplaceFailed = $('<button>');
			ReplaceFailed.click(() => {
				event.stopPropagation();
				ShowReplacePrompt();
			});
			ReplaceFailed.addClass(
				'red-ui-button red-ui-button-small zwave-js-round-square'
			);
			ReplaceFailed.css({
				width: '30px',
				height: '30px',
				marginRight: '1px'
			});
			ReplaceFailed.append('<i class="fa fa-chain-broken fa-lg"></i>');
			RED.popover.tooltip(ReplaceFailed, 'Replace Failed Node');
			BA.append(ReplaceFailed);

			const _OpenDB = $('<button>');
			_OpenDB.click(() => {
				IsNodeReady(HoveredNode);
				OpenDB();
			});
			_OpenDB.addClass(
				'red-ui-button red-ui-button-small zwave-js-round-square'
			);
			_OpenDB.css({
				width: '30px',
				height: '30px',
				marginRight: '1px'
			});
			_OpenDB.append('<i class="fa fa-database fa-lg"></i>');
			RED.popover.tooltip(_OpenDB, 'Open in Device Browser');
			BA.append(_OpenDB);
		} else {
			BA.css({
				display: 'block'
			});
		}

		Row.append(BA);
	}

	function ResetBA() {
		if (LastTargetForBA !== undefined) {
			LastTargetForBA.children().css({ display: 'block' });
		}
		if (BA !== undefined) {
			BA.css({
				display: 'none'
			});
		}
	}

	function renderNode(node) {
		return $('<div>')
			.addClass('red-ui-treeList-label zwave-js-node-row')
			.attr('data-nodeid', node.nodeId)
			.data('info', node)
			.click((e) => {
				if (selectedNode === node.nodeId) {
					ResetBA();
					const Row = $(
						'.zwave-js-node-row[data-nodeid="' + node.nodeId + '"]'
					);
					AddOverlayNodeButtons(node, $(Row));
					LastTargetForBA = $(Row);
					return;
				} else {
					if (e.shiftKey) {
						ResetBA();
						const Row = $(
							'.zwave-js-node-row[data-nodeid="' + node.nodeId + '"]'
						);
						AddOverlayNodeButtons(node, $(Row));
						LastTargetForBA = $(Row);
					} else {
						ResetBA();
						IsNodeReady(node);
						selectNode(node.nodeId);
					}
				}
			})
			.append(
				$('<div>').html(node.nodeId).addClass('zwave-js-node-row-id'),
				$('<div>').html(node.name).addClass('zwave-js-node-row-name'),
				$('<div>')
					.html(renderStatusIcon(node.status.toUpperCase()))
					.addClass('zwave-js-node-row-status'),
				$('<div>')
					.html(renderReadyIcon(node))
					.addClass('zwave-js-node-row-ready'),
				$('<div>')
					.html(renderBattery(node))
					.addClass('zwave-js-node-row-battery'),
				$('<div>').html(renderLock(node)).addClass('zwave-js-node-row-security')
			);
	}

	function renderReadyIcon(node) {
		const i = $('<i>');

		if (node.interviewStage !== 'Complete') {
			i.addClass('fa fa-hourglass');
			RED.popover.tooltip(i, 'Pending Completed Interview');
		} else {
			if (node.ready) {
				i.addClass('fa fa-thumbs-up');
				RED.popover.tooltip(i, 'Ready');
			}
		}

		return i;
	}

	function renderStatusIcon(status) {
		const i = $('<i>');

		switch (status) {
			case 'ASLEEP':
				i.addClass('fa fa-moon-o fa-2x');
				RED.popover.tooltip(i, 'Asleep');
				break;
			case 'AWAKE':
			case 'ALIVE':
				i.addClass('fa fa-sun-o fa-2x');
				RED.popover.tooltip(i, 'Alive and/or Awake');
				break;
			case 'DEAD':
				i.addClass('fa fa-exclamation-triangle fa-2x');
				i.css({ color: 'red' });
				RED.popover.tooltip(i, 'Failed');
				break;
		}

		return i;
	}

	function makeInfo(elId, deviceConfig = {}, firmwareVersion) {
		const el = $(elId);
		el.html(
			`${deviceConfig.manufacturer} | ${deviceConfig.label} | FW: ${firmwareVersion}`
		);
	}

	function deselectCurrentNode() {
		if (selectedNode) {
			$(`#zwave-js-node-list [data-nodeid='${selectedNode}']`).removeClass(
				'currentNode'
			);

			$('#zwave-js-status-box-interview').text('');

			$('#zwave-js-node-properties').treeList('empty');
			RED.comms.unsubscribe(
				`/zwave-js/${NetworkIdentifier}/cmd/${selectedNode}`,
				handleNodeEvent
			);
		}

		$('#zwave-js-current-node-id').html('--');
		$('#zwave-js-selected-node-name').html('No Node Selected');
		$('#zwave-js-selected-node-info').html('No Node Selected');
		selectedNode = undefined;
	}

	function selectNode(id) {
		if (selectedNode == id) return;
		deselectCurrentNode();

		selectedNode = id;

		const selectedEl = $(`#zwave-js-node-list [data-nodeid='${id}']`);
		selectedEl.addClass('currentNode');
		const info = selectedEl.data('info');

		$('#zwave-js-current-node-id').html(selectedNode);
		makeInfo(
			'#zwave-js-selected-node-info',
			info.deviceConfig,
			info.firmwareVersion
		);

		let Name = `${
			info.name !== undefined && info.name.length > 0 ? info.name : 'No Name'
		}`;

		if (info.location !== undefined && info.location.length > 0)
			Name += ` (${info.location})`;

		$('#zwave-js-selected-node-name').text(Name);

		getProperties();
		RED.comms.subscribe(
			`/zwave-js/${NetworkIdentifier}/cmd/${selectedNode}`,
			handleNodeEvent
		);
	}

	function handleNodeEvent(topic, data) {
		const nodeId = topic.split('/')[4];

		if (nodeId != selectedNode) return;
		switch (data.type) {
			case 'node-value':
				updateValue(data.payload);
				break;

			case 'node-meta':
				updateMeta(data.payload, data.payload.metadata);
				break;

			case 'node-fwu-progress':
				const Sent = data.payload.sent;
				const Remain = data.payload.remain;
				const Percent = (Sent / Remain) * 100;
				$('#FWProgress > div').css({ width: `${Percent}%` });
				break;

			case 'node-fwu-completed':
				deselectCurrentNode();
				FWRunning = false;
				FirmwareForm.dialog('destroy');

				switch (data.payload.status) {
					case 253:
						modalAlert(
							`The firmware for node ${nodeId}  has been updated. Activation is pending.`,
							'ZWave Device Firmware Update'
						);
						break;
					case 254:
						modalAlert(
							`The firmware for node ${nodeId} has been updated.`,
							'ZWave Device Firmware Update'
						);
						break;
					case 255:
						modalAlert(
							`The firmware for node ${nodeId} has been updated. A restart is required (which may happen automatically)`,
							'ZWave Device Firmware Update'
						);
						break;
					default:
						modalAlert(
							`The firmware for node ${nodeId} failed to get updated. Error Code: ${data.payload.status}`,
							'ZWave Device Firmware Update'
						);
				}
				break;
		}
	}

	function updateNodeFetchStatus(text) {
		$('#zwave-js-node-properties').treeList('data', [
			{ label: text, class: 'zwave-js-node-fetch-status' }
		]);
	}

	function getProperties() {
		updateNodeFetchStatus('Fetching properties...');

		ControllerCMD(
			DCs.getDefinedValueIDs.API,
			DCs.getDefinedValueIDs.name,
			selectedNode,
			undefined,
			DCs.getDefinedValueIDs.noWait
		)
			.then(({ object }) => buildPropertyTree(object))
			.catch((err) => {
				modalAlert(err.responseText, 'Could not fetch Node properties.');
				throw new Error(err.responseText);
			});
	}

	const uniqBy = (collection, ...props) => {
		const uniqMap = {};
		collection.forEach((obj) => {
			const key = props.map((p) => obj[p]).join('-');
			if (!uniqMap.hasOwnProperty(key)) uniqMap[key] = obj;
		});
		return Object.values(uniqMap);
	};

	function buildPropertyTree(valueIdList) {
		if (valueIdList.length == 0) {
			updateNodeFetchStatus('No properties found');
			return;
		}
		updateNodeFetchStatus('');

		// Step 1: Make list of all supported command classes
		const data = uniqBy(valueIdList, 'commandClass')
			.sort((a, b) => a.commandClassName.localeCompare(b.commandClassName))
			.map(({ commandClass, commandClassName }) => {
				// Step 2: For each CC, get all associated properties
				const propsInCC = valueIdList.filter(
					(valueId) => valueId.commandClass == commandClass
				);

				return {
					element: renderCommandClassElement(commandClass, commandClassName),
					expanded: false,
					children: propsInCC.map((valueId) => {
						return { element: renderPropertyElement(valueId) };
					})
				};
			});

		// Step 3: Render tree
		const propertyList = $('#zwave-js-node-properties');
		propertyList.treeList('data', data);

		// Step 4: Add endpoint numbers where applicable
		propertyList
			.find('.zwave-js-node-property')
			.filter(function () {
				return +$(this).attr('data-endpoint') > 0;
			})
			.each(function () {
				$(this)
					.prev()
					.prev()
					.html(
						$('<span>')
							.addClass('zwave-js-node-property-endpoint')
							.text(+$(this).attr('data-endpoint'))
					);
			});

		// Step 5: Build endpoint filter buttons
		const endpoints = uniqBy(valueIdList, 'endpoint').map(
			(valueId) => valueId.endpoint
		);
		const filter = $('#zwave-js-node-endpoint-filter');
		filter.empty();
		if (endpoints.length > 1) {
			filter.append(
				'Filter by endpoint:',
				endpoints.map((ep) => {
					return $('<button>')
						.addClass('red-ui-button red-ui-button-small')
						.css({ marginLeft: 1 })
						.text(ep)
						.click(() => {
							$('.zwave-js-node-property').closest('li').hide();
							$(`.zwave-js-node-property[data-endpoint="${ep}"]`)
								.closest('li')
								.show();
						});
				}),
				$('<button>')
					.addClass('red-ui-button red-ui-button-small')
					.css({ marginLeft: 1 })
					.text('ALL')
					.click(() => {
						$('.zwave-js-node-property').closest('li').show();
					})
			);
		}
	}

	function renderCommandClassElement(commandClass, commandClassName) {
		const el = $('<span>').text(commandClassName);
		RED.popover.tooltip(el, hexDisplay(commandClass));
		return el;
	}

	function renderPropertyElement(valueId) {
		const el = $('<div>')
			.addClass('zwave-js-node-property')
			.attr('data-endpoint', valueId.endpoint)
			.attr('data-propertyId', makePropertyId(valueId))
			.data('valueId', valueId);
		const label =
			valueId.propertyKeyName ??
			valueId.propertyName ??
			valueId.property +
				(valueId.propertyKey !== undefined
					? `[0x${valueId.propertyKey
							.toString(16)
							.toUpperCase()
							.padStart(2, '0')}]`
					: '');
		$('<span>')
			.addClass('zwave-js-node-property-name')
			.text(label)
			.appendTo(el);
		$('<span>').addClass('zwave-js-node-property-value').appendTo(el);
		getValue(valueId);
		el.dblclick(function () {
			const data = $(this).data();
			const valueData = $(this).find('.zwave-js-node-property-value').data();
			$('<div>')
				.css({ maxHeight: '80%' })
				.html(
					`<pre class="MonitorEntry">${JSONFormatter.json.prettyPrint({
						...data,
						valueData
					})}</pre>`
				)
				.dialog({
					draggable: true,
					modal: true,
					resizable: false,
					width: 'auto',
					title: 'Information',
					minHeight: 75,
					buttons: {
						'Add To Filter Set': function () {
							if (AddValueIDToFilter(data.valueId)) {
								$(this).dialog('destroy');
							} else {
								modalAlert(
									'Please activate the target filter set.',
									'No Active Filter Set'
								);
							}
						},
						Close: function () {
							$(this).dialog('destroy');
						}
					}
				});
		});
		return el;
	}

	function getValue(valueId) {
		ControllerCMD(
			DCs.getValue.API,
			DCs.getValue.name,
			selectedNode,
			[valueId],
			DCs.getValue.noWait
		)
			.then(({ node, object }) => {
				if (node != selectedNode) {
					return;
				}
				updateValue({ ...valueId, currentValue: object.currentValue });
				ControllerCMD(
					DCs.getValueMetadata.API,
					DCs.getValueMetadata.name,
					selectedNode,
					[valueId],
					DCs.getValueMetadata.noWait
				)
					.then(({ node, object }) => {
						if (!object.metadata || node != selectedNode) {
							return;
						}
						updateMeta(valueId, object.metadata);
					})
					.catch((err) => {
						modalAlert(err.responseText, 'Could not fetch value Metadata.');
						throw new Error(err.responseText);
					});
			})
			.catch((err) => {
				modalAlert(err.responseText, 'Could not fetch value.');
				throw new Error(err.responseText);
			});
	}

	function handleBattery(topic, data) {
		const BatterySymbol = $(
			`#zwave-js-node-list > div.red-ui-treeList-label.zwave-js-node-row[data-nodeid='${data.node}'] > div.zwave-js-node-row-battery > i`
		);

		switch (data.payload.property) {
			case 'level':
				let Class;
				data.payload.newValue > 90
					? (Class = 'fa fa-battery-full')
					: data.payload.newValue > 65
					? (Class = 'fa fa-battery-three-quarters')
					: data.payload.newValue > 35
					? (Class = 'fa fa-battery-half')
					: data.payload.newValue > 10
					? (Class = 'fa fa-battery-quarter')
					: (Class = 'fa fa-battery-empty');
				BatterySymbol.removeClass();
				BatterySymbol.addClass(Class);
				BatteryUIElements[data.node].setContent(
					'Level: ' + data.payload.newValue
				);
				break;

			case 'isLow':
				if (data.payload.newValue) {
					BatterySymbol.css({ color: 'red' });
				} else {
					BatterySymbol.css({ color: '#555' });
				}
				break;
		}
	}

	function updateValue(valueId) {
		// Assumes you already checked if this applies to selectedNode
		const propertyRow = getPropertyRow(valueId);

		if (!propertyRow) {
			// AHHH!!! What do we do now?!
			// No easy way to insert a branch into the treeList.
			// So for now, just re-fetch the entire property list.
			// We'll figure out something better later.
			getProperties();
			return;
		}

		const propertyValue = propertyRow.find('.zwave-js-node-property-value');
		const meta = propertyRow.data('meta');

		// Check if this is a 'value removed' event
		if (
			valueId.hasOwnProperty('prevValue') &&
			!valueId.hasOwnProperty('newValue')
		) {
			propertyValue.text('');
			return;
		}

		// If value is not provided in arguments or in the valueId, then use the stored raw value.
		const value =
			valueId.newValue ??
			valueId.currentValue ??
			propertyValue.data('value') ??
			'';

		if (meta?.states?.[value]) {
			// If meta known, translate the value and add tooltip with raw value
			propertyValue.text(meta?.states?.[value]);
			RED.popover.tooltip(propertyValue, `Raw Value: ${value}`);
		} else if (valueId.commandClass == 114) {
			// If command class "Manufacturer Specific", show hex values
			propertyValue.text(hexDisplay(value));
			if (valueId.property == 'manufacturerId')
				RED.popover.tooltip(
					propertyValue,
					$(`#zwave-js-node-list .selected`).data('info')?.deviceConfig
						?.manufacturer
				);
		} else if (propertyValue.data('unit')) {
			// If has units, include
			propertyValue.text(`${value} ${propertyValue.data('unit')}`);
		} else {
			// Otherwise just display raw value
			propertyValue.text(value);
		}

		// Some formatting
		if (/^(true|false)$/.test(value)) {
			propertyValue.addClass(`zwave-js-property-value-type-boolean`);
		}

		// Store raw value in data
		propertyValue.data('value', value);
	}

	function updateMeta(valueId, meta = {}) {
		// Assumes you already checked if this applies to selectedNode

		const propertyRow = getPropertyRow(valueId);
		const propertyValue = propertyRow.find('.zwave-js-node-property-value');

		propertyRow.data('meta', meta);

		// Update label and/or description
		const propertyName = propertyRow.find('.zwave-js-node-property-name');
		if (meta.hasOwnProperty('label')) propertyName.text(meta.label);
		if (meta.hasOwnProperty('description'))
			RED.popover.tooltip(propertyName, meta.description);

		// If states are provided, translate and add tooltip with raw value
		const value = propertyValue.data('value');
		if (meta.states?.[value]) {
			propertyValue.text(meta.states?.[value]);
			RED.popover.tooltip(propertyValue, `Raw Value: ${value}`);
		}

		// If unit is provided, add to value
		if (meta.hasOwnProperty('unit')) {
			propertyValue.data('unit', meta.unit);
			propertyValue.text(`${value} ${meta.unit}`);
		}

		// Add "edit" icon, if applicable
		const icon = propertyRow.prev();
		icon.empty();
		if (meta.writeable)
			$('<i>')
				.addClass('fa fa-pencil zwave-js-node-property-edit-button')
				.click(() => showEditor(valueId))
				.appendTo(icon);
	}

	function showEditor(valueId) {
		const propertyRow = getPropertyRow(valueId);

		// If editor is already displayed, close it instead
		const next = propertyRow.next();
		if (next.is('.zwave-js-node-property-editor')) {
			next.remove();
			return;
		}

		const meta = propertyRow.data('meta');
		const input = $('<input>');
		input.keyup(() => {
			if (event.which === 13) {
				CommitNewVal();
			}
		});
		let editor;
		function CommitNewVal(val) {
			if (val == undefined) {
				val = input.val();
			}
			if (meta.type == 'number') {
				val = +val;
			}
			ControllerCMD(
				DCs.setValue.API,
				DCs.setValue.name,
				selectedNode,
				[valueId, val],
				DCs.setValue.noWait
			).catch((err) => {
				modalAlert(err.responseText, 'Could not set value.');
				throw new Error(err.responseText);
			});
			editor.remove();
		}

		if (meta.writeable) {
			// Step 1: Create editor block and add below value block

			editor = $('<div>')
				.addClass('zwave-js-node-property-editor')
				.css({ paddingLeft: 40 });

			propertyRow.after(editor);

			// eslint-disable-next-line no-inner-declarations
			function makeSetButton(val) {
				return $('<button>')
					.addClass('red-ui-button red-ui-button-small')
					.css({ marginRight: 5 })
					.html('Set')
					.click(() => {
						CommitNewVal(val);
					});
			}
			// eslint-disable-next-line no-inner-declarations
			function makeInfoStr(...fields) {
				return fields
					.map(
						([label, prop]) =>
							meta.hasOwnProperty(prop) && `${label}: ${meta[prop]}`
					)
					.filter((s) => s)
					.join(' | ');
			}

			// Step 2: Generate input(s) with Set button(s)

			if (meta.hasOwnProperty('states')) {
				// STATES
				editor.append(
					Object.entries(meta.states).map(([val, label]) => {
						const labelSpan = $('<span>').text(label);
						RED.popover.tooltip(labelSpan, `Raw Value: ${val}`);
						return $('<div>').append(makeSetButton(val), labelSpan);
					})
				);
			}

			if (meta.allowManualEntry === undefined || meta.allowManualEntry) {
				if (meta.type == 'number') {
					// Number
					editor.append(
						input,
						makeSetButton(),
						$('<span>').text(
							makeInfoStr(
								['Default', 'default'],
								['Min', 'min'],
								['Max', 'max'],
								['Step', 'step']
							)
						)
					);
				} else if (meta.type == 'boolean') {
					// BOOLEAN
					editor.append(
						$('<div>').append(
							makeSetButton(true),
							$('<span>')
								.addClass('zwave-js-property-value-type-boolean')
								.text('True')
						),
						$('<div>').append(
							makeSetButton(false),
							$('<span>')
								.addClass('zwave-js-property-value-type-boolean')
								.text('False')
						)
					);
				} else if (meta.type == 'string') {
					// STRING
					editor.append(
						input,
						makeSetButton(),
						$('<span>').text(
							makeInfoStr(
								['Min Length', 'minLength'],
								['Max Length', 'maxLength']
							)
						)
					);
				} else if (meta.type == 'any') {
					// ANY
					editor.append(
						input,
						makeSetButton(),
						$('<span>').html('Caution: ValueType is "Any"')
					);
					return;
				} else {
					// How did you get here?
					editor.append('Missing ValueType');
					return;
				}
			}
		}
	}

	function hexDisplay(integer) {
		return `#${integer} | 0x${integer
			.toString(16)
			.toUpperCase()
			.padStart(4, '0')}`;
	}

	function makePropertyId(valueId) {
		return [
			valueId.endpoint || '0',
			valueId.commandClass,
			valueId.property,
			valueId.propertyKey
		].join('-');
	}

	function getPropertyRow(valueId) {
		return $(
			`#zwave-js-node-properties [data-propertyId="${makePropertyId(valueId)}"]`
		);
	}

	function getLatestStatus() {
		$.ajax({
			url: `zwave-js/${NetworkIdentifier}/fetch-driver-status`,
			method: 'GET'
		});
	}

	return { init: init, ControllerCMD: ControllerCMD };
})();
