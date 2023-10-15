/* eslint-env jquery */
/* eslint-env browser */
/*eslint no-undef: "warn"*/
/*eslint no-unused-vars: "warn"*/

/* UI Inclusion Functions */
let StartInclusionExclusion;
let StartReplace;
let GrantSelected;
let ValidateDSK;

/* Firmware */
let CheckForUpdate;

/* UI RF Functions */
let SetPowerLevel;
let SetRegion;
let backupNVMRaw;
let restoreNVM;

let GroupedNodes = true;

/* Just stuff */
let DriverReady = false;
const WindowSize = { w: 700, h: 600 };
let NetworkIdentifier = undefined;

/* Commands used throughout */
const DCs = {
	backupNVMRaw: {
		API: 'ControllerAPI',
		name: 'backupNVMRaw',
		noWait: true
	},
	getRFRegion: {
		API: 'ControllerAPI',
		name: 'getRFRegion',
		noWait: false
	},
	setRFRegion: {
		API: 'ControllerAPI',
		name: 'setRFRegion',
		noWait: false
	},
	getPowerlevel: {
		API: 'ControllerAPI',
		name: 'getPowerlevel',
		noWait: false
	},
	setPowerlevel: {
		API: 'ControllerAPI',
		name: 'setPowerlevel',
		noWait: false
	},
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
	rebuildNodeRoutes: {
		API: 'ControllerAPI',
		name: 'rebuildNodeRoutes',
		noWait: true
	},
	beginRebuildingRoutes: {
		API: 'ControllerAPI',
		name: 'beginRebuildingRoutes',
		noWait: false
	},
	stopRebuildingRoutes: {
		API: 'ControllerAPI',
		name: 'stopRebuildingRoutes',
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
	},
	getValueDB: {
		API: 'DriverAPI',
		name: 'getValueDB',
		noWait: false
	},
	getAvailableFirmwareUpdates: {
		API: 'ControllerAPI',
		name: 'getAvailableFirmwareUpdates',
		noWait: false
	},
	firmwareUpdateOTA: {
		API: 'ControllerAPI',
		name: 'firmwareUpdateOTA',
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
		if (pVal) r = r + (pVal[0] === '"' ? str : val) + pVal + '</span>';
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
	let RFForm; // FrimwareForm
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
	let WakeResolver; // Resolve for wake wait
	let WakeResolverTarget; // Target Wake Node
	let NodesListed = false; // nodes listed

	function modalAlert(message, title) {
		const Buts = {
			Ok: function () {}
		};
		modalPrompt(message, title, Buts);
	}

	function modalPrompt(message, title, buttons, addCancel, IsHTML) {
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

		const D = $('<div>').css({
			padding: 10,
			maxWidth: 500,
			wordWrap: 'break-word'
		});

		if (IsHTML) {
			D.html(message);
		} else {
			D.text(message);
		}
		D.dialog(Options);
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
				modalAlert(
					err.responseText || err.message,
					'Could not start Health Check.'
				);
				throw new Error(err.responseText || err.message);
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
					console.error(err);
				});
		} else {
			FirmwareForm.dialog('destroy');
		}
		FWRunning = false;
	}

	async function PerformUpdateFromService(Node, File) {
		const nodeRow = $('#zwave-js-node-list').find(`[data-nodeid='${Node}']`);
		if (nodeRow.data().info.status.toUpperCase() === 'ASLEEP') {
			const A = await WaitForNodeWake(Node);
			if (!A) {
				return;
			}
		}

		ControllerCMD(
			DCs.firmwareUpdateOTA.API,
			DCs.firmwareUpdateOTA.name,
			undefined,
			[Node, File],
			DCs.firmwareUpdateOTA.noWait
		)
			.then(() => {
				FWRunning = true;
				selectNode(Node);
				$(":button:contains('Begin Update')")
					.prop('disabled', true)
					.addClass('ui-state-disabled');
				$('#FWProgress').css({ display: 'block' });
			})
			.catch((err) => {
				modalAlert(err.responseText || err.message, 'Firmware rejected');
				throw new Error(err.responseText || err.message);
			});
	}

	async function PerformUpdate() {
		const CurrentFWMode = $('#tabs').tabs('option', 'active');

		if (CurrentFWMode === 0) {
			const SelectedFW = $('#NODE_FWCV').find(':selected').data('FWTarget');
			PerformUpdateFromService(SelectedFW.node, SelectedFW.file);
			return;
		}

		const FE = $('#FILE_FW')[0].files[0];
		const NID = parseInt($('#NODE_FW option:selected').val());
		const Target = $('#TARGET_FW').val();

		const nodeRow = $('#zwave-js-node-list').find(`[data-nodeid='${NID}']`);
		if (nodeRow.data().info.status.toUpperCase() === 'ASLEEP') {
			const A = await WaitForNodeWake(NID);
			if (!A) {
				return;
			}
		}

		const FD = new FormData();
		FD.append('Binary', FE);
		FD.append('NodeID', NID);
		FD.append('Target', Target);

		const Options = {
			url: `zwave-js/${NetworkIdentifier}/firmwareupdate`,
			method: 'POST',
			contentType: false,
			processData: false,
			data: FD
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
				modalAlert(err.responseText || err.message, 'Firmware rejected');
				throw new Error(err.responseText || err.message);
			});
	}

	function FirmwareUpdate() {
		const Options = {
			draggable: false,
			modal: true,
			resizable: false,
			width: WindowSize.w,
			height: WindowSize.h,
			title: `ZWave Device Firmware Updater (Network ${NetworkIdentifier})`,
			minHeight: 75,
			buttons: {
				'Begin Update': PerformUpdate,
				Cancel: function () {
					AbortUpdate();
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
				const EP = parseInt(EI.val());
				const ND = parseInt(NI.val());
				const AD = { nodeId: ND };
				if (EP > 0) {
					AD.endpoint = EP;
				}

				const TR = $('<tr>');
				$('<td>')
					.html(
						`<div class="zwave-js-ac" style="display:inline-block"><i class="fa fa-plus fa-lg"></i></div> ${ND}`
					)
					.appendTo(TR);
				$('<td>')
					.text(EP < 1 ? '0 (Root Device)' : EP)
					.appendTo(TR);
				const TD3 = $('<td>').css({ textAlign: 'right' }).appendTo(TR);
				$('<input>')
					.attr('type', 'button')
					.addClass('ui-button ui-corner-all ui-widget')
					.attr('value', 'Delete')
					.attr('data-address', JSON.stringify(AD))
					.attr('data-committed', false)
					.attr('data-action', 'add')
					.click(DeleteAssociation)
					.appendTo(TD3);

				$('#zwave-js-associations-table').append(TR);
			}
		};

		const HTML = $('<div>').append('Node ID: ');
		NI.appendTo(HTML);
		HTML.append(' Endpoint: ');
		EI.appendTo(HTML);

		modalPrompt(HTML, 'New Association', Buttons, true, true);
	}

	function DeleteAssociation() {
		const Button = $(this);
		const Buttons = {
			Yes: function () {
				const Committed =
					Button.attr('data-committed') === 'true' ? true : false;

				if (Committed) {
					Button.attr('data-committed', false);
					Button.attr('data-action', 'remove');
					Button.closest('tr')
						.children('td:first')
						.find('.zwave-js-ac')
						.css({ display: 'inline-block' })
						.html('<i class="fa fa-trash fa-lg"></i>');
					Button.off('click');
				} else {
					Button.closest('tr').remove();
				}
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
						$('<td>')
							.html(
								`<div class="zwave-js-ac"><i class="fa fa-plus fa-lg"></i></div> ${AD.nodeId}`
							)
							.appendTo(TR);
						$('<td>')
							.html(AD.endpoint ?? '0 (Root Device)')
							.appendTo(TR);
						const TD3 = $('<td>').css({ textAlign: 'right' }).appendTo(TR);
						$('<input>')
							.attr('type', 'button')
							.addClass('ui-button ui-corner-all ui-widget')
							.attr('value', 'Delete')
							.attr('data-address', JSON.stringify(AD))
							.attr('data-committed', true)
							.click(DeleteAssociation)
							.appendTo(TD3);

						$('#zwave-js-associations-table').append(TR);
					});
				});
			})
			.catch((err) => {
				modalAlert(
					err.responseText || err.message,
					'Could not get associations.'
				);
				throw new Error(err.responseText || err.message);
			});
	}

	async function WaitForNodeWake(NodeID) {
		const Buttons = {
			Cancel: function () {
				WakeResolver(false);
			}
		};

		const WD = modalPrompt(
			'This device is asleep, please wake it up...',
			'Waiting for device to wake up',
			Buttons,
			false
		);

		WakeResolverTarget = NodeID;

		const Result = await new Promise((res) => {
			WakeResolver = res;
		});

		WakeResolver = undefined;
		WakeResolverTarget = undefined;

		try {
			WD.dialog('destroy');
		} catch (Err) {
			// WD could already be destroyed
		}

		return Result;
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
						'Commit Changes': async function () {
							const nodeRow = $('#zwave-js-node-list').find(
								`[data-nodeid='${HoveredNode.nodeId}']`
							);

							if (nodeRow.data().info.status.toUpperCase() === 'ASLEEP') {
								const A = await WaitForNodeWake(HoveredNode.nodeId);
								if (!A) {
									return;
								}
							}

							const Removals = $('#zwave-js-associations-table').find(
								"input[data-committed='false'][data-action='remove']"
							);
							const Additions = $('#zwave-js-associations-table').find(
								"input[data-committed='false'][data-action='add']"
							);

							const D = modalPrompt(
								'Processing association changes...',
								'Please wait.',
								{},
								false
							);

							const DoRemovals = () => {
								return new Promise((resolve, reject) => {
									const PL = [
										{
											nodeId: HoveredNode.nodeId,
											endpoint: parseInt($('#NODE_EP').val())
										},
										parseInt($('#NODE_G').val()),
										[]
									];

									Removals.each(function (index) {
										PL[2].push(JSON.parse($(this).attr('data-address')));
									});

									if (Removals.length < 1) {
										resolve();
										return;
									}

									ControllerCMD(
										DCs.removeAssociations.API,
										DCs.removeAssociations.name,
										undefined,
										PL,
										DCs.removeAssociations.noWait
									)
										.then(() => {
											resolve();
										})
										.catch((err) => {
											reject(err);
										});
								});
							};

							const DoAdditions = () => {
								return new Promise((resolve, reject) => {
									const PL = [
										{
											nodeId: HoveredNode.nodeId,
											endpoint: parseInt($('#NODE_EP').val())
										},
										parseInt($('#NODE_G').val()),
										[]
									];

									Additions.each(function (index) {
										PL[2].push(JSON.parse($(this).attr('data-address')));
									});

									if (Additions.length < 1) {
										resolve();
										return;
									}

									ControllerCMD(
										DCs.addAssociations.API,
										DCs.addAssociations.name,
										undefined,
										PL,
										DCs.addAssociations.noWait
									)
										.then(() => {
											resolve();
										})
										.catch((err) => {
											reject(err);
										});
								});
							};

							DoRemovals()
								.then(() => {
									DoAdditions()
										.then(() => {
											D.dialog('destroy');
											GMGroupSelected();
										})
										.catch((err) => {
											D.dialog('destroy');
											modalAlert(
												err.responseText || err.message,
												'Could not process association changes.'
											);
											throw new Error(err.responseText || err.message);
										});
								})
								.catch((err) => {
									D.dialog('destroy');
									modalAlert(
										err.responseText || err.message,
										'Could not process association changes.'
									);
									throw new Error(err.responseText || err.message);
								});
						},
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
				modalAlert(
					err.responseText || err.message,
					'Could not get associtions.'
				);
				throw new Error(err.responseText || err.message);
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
							lastSeen: N.lastSeen,
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
							rej(err.responseText || err.message);
						});
				})
				.catch((err) => {
					rej(err.responseText || err.message);
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
				modalAlert(err.responseText || err.message, 'Could not generate map.');
				throw new Error(err.responseText || err.message);
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
			modalAlert(
				'This node is not ready. Shift + click to view options',
				'Node Not Ready'
			);
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
			// Hopefully we will never have to depend on this, if so - there is something seriously wrong with the browser, that the user should resolve.
			// Our internal timeouts of 15s will see to anything driver/server related
			Options.timeout = 30000;
		}

		const RestrictedModes = ['IEAPI'];
		const RestrictedMethods = [
			'setPowerlevel',
			'updateFirmware',
			'abortFirmwareUpdate',
			'setRFRegion',
			'hardReset',
			'backupNVMRaw'
		];

		if (
			!RestrictedModes.includes(mode) &&
			!RestrictedMethods.includes(method)
		) {
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
				NodesListed = true;
				$('#zwave-js-node-properties').treeList('empty');
			})
			.catch((err) => {
				modalAlert(err.responseText || err.message, 'Could not fetch nodes.');
				throw new Error(err.responseText || err.message);
			});
	}

	function EnableCritical(Value) {
		if (Value) {
			$('.CriticalDisable').prop('disabled', false);
			$('.CriticalDisable').css({ opacity: '1.0' });
		} else {
			$('.CriticalDisable').prop('disabled', true);
			$('.CriticalDisable').css({ opacity: '0.4' });
		}
	}

	restoreNVM = () => {
		$('#FILE_BU').on('change', () => {
			const FE = $('#FILE_BU')[0].files[0];

			const FD = new FormData();
			FD.append('Binary', FE);

			const Options = {
				url: `zwave-js/${NetworkIdentifier}/restorenvm`,
				method: 'POST',
				contentType: false,
				processData: false,
				data: FD
			};
			$.ajax(Options)
				.then(() => {
					EnableCritical(false);
					$('#NVMProgressLabel').html('Starting Restore...');
					$('#NVMProgress').css({ display: 'block' });
				})
				.catch((err) => {
					modalAlert(err.responseText || err.message, 'Could not restore NVM.');
					EnableCritical(true);
					throw new Error(err.responseText || err.message);
				});

			$('#FILE_BU').off('change');
		});

		$('#FILE_BU').click();
	};

	backupNVMRaw = () => {
		EnableCritical(false);
		ControllerCMD(
			DCs.backupNVMRaw.API,
			DCs.backupNVMRaw.name,
			undefined,
			undefined,
			DCs.backupNVMRaw.noWait
		)
			.catch((err) => {
				modalAlert(err.responseText || err.message, 'Could not back NVM.');
				EnableCritical(true);
				throw new Error(err.responseText || err.message);
			})
			.then(() => {
				$('#NVMProgressLabel').html('Backing up NVM...');
				$('#NVMProgress').css({ display: 'block' });
			});
	};

	SetRegion = () => {
		EnableCritical(false);
		ControllerCMD(
			DCs.setRFRegion.API,
			DCs.setRFRegion.name,
			undefined,
			[parseInt($('#RF_REGION').val())],
			DCs.setRFRegion.noWait
		)
			.catch((err) => {
				modalAlert(err.responseText || err.message, 'Could not set RF Region.');
				EnableCritical(true);
				throw new Error(err.responseText || err.message);
			})
			.then(({ object }) => {
				EnableCritical(true);
				if (!object.success) {
					modalAlert(
						'The controller did not accept the values provided.',
						'Could not set RF Region.'
					);
				} else {
					modalAlert('Settings were applied successfully.', 'RF Region set.');
				}
			});
	};

	SetPowerLevel = () => {
		EnableCritical(false);
		ControllerCMD(
			DCs.setPowerlevel.API,
			DCs.setPowerlevel.name,
			undefined,
			[
				parseFloat($('#RF_POWER').slider('value')),
				parseFloat($('#RF_0DBM').slider('value'))
			],
			DCs.setPowerlevel.noWait
		)
			.catch((err) => {
				modalAlert(
					err.responseText || err.message,
					'Could not set power level.'
				);
				EnableCritical(true);
				throw new Error(err.responseText || err.message);
			})
			.then(({ object }) => {
				EnableCritical(true);
				if (!object.success) {
					modalAlert(
						'The controller did not accept the values provided.',
						'Could not set power level.'
					);
				} else {
					modalAlert('Settings were applied successfully.', 'Power level set.');
				}
			});
	};

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
				modalAlert(err.responseText || err.message, 'Could not verify DSK.');
				throw new Error(err.responseText || err.message);
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
				modalAlert(
					err.responseText || err.message,
					'Could not grant Security Classes.'
				);
				throw new Error(err.responseText || err.message);
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
						modalAlert(
							err.responseText || err.message,
							'Could not replace Node.'
						);
						$(B).html(OT);
						$(B).prop('disabled', false);
						throw new Error(err.responseText || err.message);
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
				modalAlert(err.responseText || err.message, 'Could not replace Node.');
				throw new Error(err.responseText || err.message);
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
						modalAlert(
							err.responseText || err.message,
							'Could not fetch Smart Start list.'
						);
						throw new Error(err.responseText || err.message);
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
													err.responseText || err.message,
													'Could not remove Smart Start entry.'
												);
												throw new Error(err.responseText || err.message);
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
						modalAlert(
							err.responseText || err.message,
							'Could not start Inclusion'
						);
						throw new Error(err.responseText || err.message);
					})
					.then(({ object }) => {
						if (object.ok) {
							$('#SmartStartCommit').css({ display: 'inline' });
							$.ajax({
								url: `zwave-js/${NetworkIdentifier}/smartstart/startserver`,
								method: 'GET',
								error: function (err) {
									modalAlert(
										err.responseText || err.message,
										'Could not start Inclusion'
									);
									throw new Error(err.responseText || err.message);
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
					modalAlert(
						err.responseText || err.message,
						'Could not start Exclusion'
					);
					throw new Error(err.responseText || err.message);
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
						modalAlert(
							err.responseText || err.message,
							'Could not start Inclusion'
						);
						throw new Error(err.responseText || err.message);
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
				modalAlert(
					err.responseText || err.message,
					'Could not start Inclusion'
				);
				throw new Error(err.responseText || err.message);
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
			title: `Node Inclusion/Exclusion (Network ${NetworkIdentifier})`,
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
											err.responseText || err.message,
											'Could not purge Smart Start entries'
										);
										throw new Error(err.responseText || err.message);
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
							console.error(err);
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
							console.error(err);
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
									console.error(err);
								});
							})
							.catch((err) => {
								$.ajax({
									url: `zwave-js/${NetworkIdentifier}/smartstart/stopserver`,
									method: 'GET'
								}).catch((err) => {
									console.error(err);
								});
								modalAlert(
									err.responseText || err.message,
									'Could not commit Smart Start entries.'
								);
								throw new Error(err.responseText || err.message);
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
							console.error(err);
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
			DCs.rebuildNodeRoutes.API,
			DCs.rebuildNodeRoutes.name,
			undefined,
			[HoveredNode.nodeId],
			DCs.rebuildNodeRoutes.noWait
		).catch((err) => {
			modalAlert(err.responseText || err.message, 'Could not start Node heal.');
			throw new Error(err.responseText || err.message);
		});
	}

	function StartHeal() {
		ControllerCMD(
			DCs.beginRebuildingRoutes.API,
			DCs.beginRebuildingRoutes.name,
			undefined,
			undefined,
			DCs.beginRebuildingRoutes.noWait
		).catch((err) => {
			modalAlert(
				err.responseText || err.message,
				'Could not start Network heal.'
			);
			throw new Error(err.responseText || err.message);
		});
	}

	function StopHeal() {
		ControllerCMD(
			DCs.stopRebuildingRoutes.API,
			DCs.stopRebuildingRoutes.name,
			undefined,
			undefined,
			DCs.stopRebuildingRoutes.noWait
		).catch((err) => {
			console.error(err);
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
						modalAlert(
							err.responseText || err.message,
							'Could not reset the Controller.'
						);
						throw new Error(err.responseText || err.message);
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
			modalAlert(
				err.responseText || err.message,
				'Could not interview the Node.'
			);
			throw new Error(err.responseText || err.message);
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

	function RFSettings() {
		const Options = {
			draggable: false,
			modal: true,
			resizable: false,
			width: WindowSize.w,
			height: WindowSize.h,
			title: `Advanced Transceiver Settings (Network ${NetworkIdentifier})`,
			minHeight: 75,
			buttons: {
				Close: function () {
					$(this).dialog('destroy');
				}
			}
		};

		RFForm = $('<div>').css({ padding: 10 }).html('Please wait...');
		RFForm.dialog(Options);

		RFForm.html('');
		const Template = $('#TPL_RF').html();
		const templateScript = Handlebars.compile(Template);
		const HTML = templateScript({});
		RFForm.append(HTML);

		$('#NVMProgress').css({ display: 'none' });

		const PowerSlider = $('#RF_POWER_SLIDER');
		$('#RF_POWER').slider({
			min: -12.8,
			max: 12.7,
			step: 0.1,
			range: 'min',
			slide: function (event, ui) {
				PowerSlider.text(ui.value);
			}
		});

		const MeasuredSlider = $('#RF_0DBM_SLIDER');
		$('#RF_0DBM').slider({
			min: -12.8,
			max: 12.7,
			step: 0.1,
			range: 'min',
			slide: function (event, ui) {
				MeasuredSlider.text(ui.value);
			}
		});

		const GetPower = () => {
			ControllerCMD(
				DCs.getPowerlevel.API,
				DCs.getPowerlevel.name,
				undefined,
				undefined,
				DCs.getPowerlevel.noWait
			)
				.then(({ object }) => {
					PowerSlider.text(object.powerlevel);
					$('#RF_POWER').slider('value', object.powerlevel);
					MeasuredSlider.text(object.measured0dBm);
					$('#RF_0DBM').slider('value', object.measured0dBm);
				})
				.catch((err) => {
					$('#RF_TR_POWER').css({ opacity: '0.3', pointerEvents: 'none' });
					console.error(err);
				});
		};

		ControllerCMD(
			DCs.getRFRegion.API,
			DCs.getRFRegion.name,
			undefined,
			undefined,
			DCs.getRFRegion.noWait
		)
			.then(({ object }) => {
				$('#RF_REGION').val(object);
				GetPower();
			})
			.catch((err) => {
				$('#RF_TR_REGION').css({ opacity: '0.3', pointerEvents: 'none' });
				console.error(err);
				GetPower();
			});
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
					{},
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
						modalAlert(
							err.responseText || err.message,
							'Could not remove the Node.'
						);
						Removing = false;
						throw new Error(err.responseText || err.message);
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

	function downloadObjectAsJSON(exportObj, exportName) {
		const dataStr =
			'data:text/json;charset=utf-8,' +
			encodeURIComponent(JSON.stringify(exportObj));
		const downloadAnchorNode = document.createElement('a');
		downloadAnchorNode.setAttribute('href', dataStr);
		downloadAnchorNode.setAttribute('download', exportName + '.json');
		document.body.appendChild(downloadAnchorNode); // required for firefox
		downloadAnchorNode.click();
		downloadAnchorNode.remove();
	}

	function ExportNLMap() {
		ControllerCMD(
			DCs.getNodes.API,
			DCs.getNodes.name,
			undefined,
			undefined,
			DCs.getNodes.noWait
		)
			.then(({ object }) => {
				const EXP = [];
				const Count = object.length;
				for (let i = 0; i < Count; i++) {
					const Node = object[i];
					if (!Node.isControllerNode) {
						if (Node.name !== undefined || Node.location !== undefined) {
							const Entry = {};
							Entry.nodeId = Node.nodeId;
							if (Node.name !== undefined) Entry.name = Node.name;
							if (Node.location !== undefined) Entry.location = Node.location;
							EXP.push(Entry);
						}
					}
				}

				downloadObjectAsJSON(
					EXP,
					`ZWave Name & Location Map NET${NetworkIdentifier}`
				);
			})
			.catch((err) => {
				modalAlert(err.responseText || err.message, 'Could not fetch nodes.');
				throw new Error(err.responseText || err.message);
			});
	}

	function ImportNLMap() {
		const input = document.createElement('input');
		input.type = 'file';

		const OnLoad = async (e) => {
			const Nodes = JSON.parse(e.target.result);

			try {
				for (let i = 0; i < Nodes.length; i++) {
					const Node = Nodes[i];

					if (Node.name !== undefined) {
						await ControllerCMD(
							DCs.setNodeName.API,
							DCs.setNodeName.name,
							undefined,
							[Node.nodeId, Node.name],
							DCs.setNodeName.noWait
						);
					}

					if (Node.location !== undefined) {
						await ControllerCMD(
							DCs.setNodeLocation.API,
							DCs.setNodeLocation.name,
							undefined,
							[Node.nodeId, Node.location],
							DCs.setNodeLocation.noWait
						);
					}
				}
				input.remove();
				GetNodes();
			} catch (err) {
				modalAlert(err.responseText || err.message, 'Could not finish import.');
				throw new Error(err.responseText || err.message);
			}
		};

		const OnChange = (e) => {
			const reader = new FileReader();
			reader.onload = OnLoad;
			reader.readAsText(e.target.files[0]);
		};
		input.onchange = OnChange;
		input.click();
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
					label: 'Begin Rebuilding Routes',
					onselect: function () {
						IsDriverReady();
						StartHeal();
					}
				},
				{
					id: 'controller-option-menu-stop-heal',
					label: 'Stop Rebuilding Routes',
					onselect: function () {
						IsDriverReady();
						StopHeal();
					}
				},
				{
					id: 'controller-option-menu-nl-export',
					label: 'Export Name/Location Map',
					onselect: function () {
						ExportNLMap();
					}
				},
				{
					id: 'controller-option-menu-nl-import',
					label: 'Import Name/Location Map',
					onselect: function () {
						ImportNLMap();
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
					id: 'controller-option-menu-rf',
					label: 'Transceiver Settings',
					onselect: function () {
						IsDriverReady();
						RFSettings();
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
			RED.comms.unsubscribe(
				`/zwave-js/${NetworkIdentifier}/backupprocess`,
				handleNVMBackupProgress
			);
			RED.comms.unsubscribe(
				`/zwave-js/${NetworkIdentifier}/backupfile`,
				handleNVMBackupFile
			);
			RED.comms.unsubscribe(
				`/zwave-js/${NetworkIdentifier}/nvmrestoreprogress`,
				handleNVMRestoreProgress
			);
			RED.comms.unsubscribe(
				`/zwave-js/${NetworkIdentifier}/nvmrestoredone`,
				handleNVMRestoreDone
			);
			RED.comms.unsubscribe(
				`/zwave-js/${NetworkIdentifier}/nvmrestoreerror`,
				handleNVMRestoreError
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
		RED.comms.subscribe(
			`/zwave-js/${NetworkIdentifier}/backupprocess`,
			handleNVMBackupProgress
		);
		RED.comms.subscribe(
			`/zwave-js/${NetworkIdentifier}/backupfile`,
			handleNVMBackupFile
		);
		RED.comms.subscribe(
			`/zwave-js/${NetworkIdentifier}/nvmrestoreprogress`,
			handleNVMRestoreProgress
		);
		RED.comms.subscribe(
			`/zwave-js/${NetworkIdentifier}/nvmrestoredone`,
			handleNVMRestoreDone
		);
		RED.comms.subscribe(
			`/zwave-js/${NetworkIdentifier}/nvmrestoreerror`,
			handleNVMRestoreError
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

		CheckForUpdate = async () => {
			const Node = parseInt($('#NODE_FWC option:selected').val());
			const nodeRow = $('#zwave-js-node-list').find(`[data-nodeid='${Node}']`);

			if (nodeRow.data().info.status.toUpperCase() === 'ASLEEP') {
				const A = await WaitForNodeWake(Node);
				if (!A) {
					return;
				}
			}

			const Wait = modalPrompt(
				'Querying Firmware Update Service..',
				'Please wait...',
				{},
				false
			);

			ControllerCMD(
				DCs.getAvailableFirmwareUpdates.API,
				DCs.getAvailableFirmwareUpdates.name,
				undefined,
				[Node],
				DCs.getAvailableFirmwareUpdates.noWait
			)
				.then(({ object }) => {
					Wait.dialog('destroy');

					const ShowCL = function () {
						const SelectedFW = $('#NODE_FWCV')
							.find(':selected')
							.data('FWTarget');
						const List = $('<ul>');
						for (let i = 0; i < SelectedFW.cl.length; i++) {
							List.append(`<li>${SelectedFW.cl[i]}</li>`);
						}

						$('#ChangeLog').empty();
						$('#ChangeLog').append(List);
					};

					$('#ChangeLog').empty();
					$('#NODE_FWCV').empty();
					$('#NODE_FWCV').append('<option>Select Version & File...</option>');
					$('#NODE_FWCV').off('change');
					$('#NODE_FWCV').change(ShowCL);

					//
					if (object.length > 0) {
						const FWs = object;
						FWs.forEach((FW) => {
							const VG = $(`<optgroup label=' --- ${FW.version} --- '>`);
							FW.files.forEach((F) => {
								const FWF = $(`<option>`);
								FWF.data('FWTarget', {
									file: F,
									node: Node,
									cl: FW.changelog.split('\n')
								});
								FWF.text(`${FW.version} -> Target : ${F.target}`);
								VG.append(FWF);
							});
							$('#NODE_FWCV').append(VG);
						});
					} else {
						modalAlert(
							'No firmware updates are available for this Node.',
							'Firmware update check'
						);
					}
					//
				})
				.catch((err) => {
					Wait.dialog('destroy');
					modalAlert(
						err.responseText || err.message,
						'Could not check for updates'
					);
					throw new Error(err.responseText || err.message);
				});
		};
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

	function handleNVMBackupFile(topic, data) {
		EnableCritical(true);
		$('#NVMProgressLabel').html('Backing up NVM Completed');

		const Bytes = new Uint8Array(data.payload.data);
		const blob = new Blob([Bytes], {
			type: 'application/octet-stream'
		});
		const DTE = new Date();
		const DD = DTE.getDate().toString().padStart(2, '0');
		const MM = (DTE.getMonth() + 1).toString().padStart(2, '0');
		const YYYY = DTE.getFullYear();

		const FN = `ZW-NET${NetworkIdentifier}-NVM-${YYYY}${MM}${DD}.bin`;

		saveAs(blob, FN);
	}

	function handleNVMBackupProgress(topic, data) {
		const P = data.payload;
		$('#NVMProgress > div').css({ width: `${P}%` });
	}

	function handleNVMRestoreProgress(topic, data) {
		const P = data.payload.progress;
		const T = data.payload.type;

		$('#NVMProgress > div').css({ width: `${P}%` });

		switch (T) {
			case 'Convert':
				$('#NVMProgressLabel').html(
					'Restoring NVM... [Stage 1/2 - Data Buffer conversion]'
				);
				break;

			default:
				$('#NVMProgressLabel').html(
					'Restoring NVM... [Stage 2/2 - Applying NVM]'
				);
				break;
		}
	}

	function handleNVMRestoreError(topic, data) {
		EnableCritical(true);
		modalAlert(data.payload, 'NVM Restore Failed');
		$('#NVMProgressLabel').html('Restoring NVM Failed');
	}

	function handleNVMRestoreDone(topic) {
		EnableCritical(true);
		modalAlert(
			'The Controller restore process has completed. The controller/driver will be restarted.',
			'NVM Restore Completed'
		);
		$('#NVMProgressLabel').html('Restoring NVM Completed');
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
					const SecurityDescription = GetSecurityClassLabel(data.securityClass);
					const HTML = `<td style="text-align: center; padding-top: 50px; font-size: 18px;"><span class="fa-stack"><span class="fa ${SecurityDescription.icon} fa-stack-2x"></span></span>${SecurityDescription.label}</td>`;
					if (
						data.inclusionResult.lowSecurity !== undefined &&
						data.inclusionResult.lowSecurity
					) {
						StepsAPI.setStepIndex(StepList.AddDoneInsecure);
						const Row = $('#IR_Security_Row_NOK');
						Row.html(HTML);
					} else {
						StepsAPI.setStepIndex(StepList.AddDone);
						const Row = $('#IR_Security_Row_OK');
						Row.html(HTML);
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

				if (NodesListed) {
					nodeRow.data().info.status = data.status;
				}

				if (data.status === 'READY') {
					if (DriverReady) {
						GetNodesThrottled();
					}
				} else {
					if (
						data.node === WakeResolverTarget &&
						WakeResolver !== undefined &&
						(data.status.toUpperCase() === 'AWAKE' ||
							data.status.toUpperCase() === 'ALIVE')
					) {
						WakeResolver(true);
					}
					if (NodesListed) {
						nodeRow
							.find('.zwave-js-node-row-status')
							.html(renderStatusIcon(data.status.toUpperCase()));
					}
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

	function GetSecurityClassLabel(SC) {
		switch (SC) {
			case 0:
				return { label: 'S2 | Unauthenticated', icon: 'fa-lock', Short: 'S2' };

			case 1:
				return { label: 'S2 | Authenticated', icon: 'fa-lock', Short: 'S2' };

			case 2:
				return { label: 'S2 | Access Control', icon: 'fa-lock', Short: 'S2' };

			case 7:
				return { label: 'S0 | Legacy', icon: 'fa-lock', Short: 'S0' };

			default:
				return { label: 'No Security', icon: 'fa-unlock-alt', Short: '' };
		}
	}

	function renderLock(node) {
		const L = $('<span>');
		L.addClass('fa-stack');
		if (node.highestSecurityClass !== undefined) {
			const SecurityDescription = GetSecurityClassLabel(
				node.highestSecurityClass
			);

			L.append(
				`<span class="fa ${SecurityDescription.icon} fa-stack-2x"></span>`
			);
			L.append(
				`<strong class="fa-stack-1x" style="font-size:80%; color:white; margin-top:4px">${SecurityDescription.Short}</strong>`
			);
			RED.popover.tooltip(L, SecurityDescription.label);
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
								if (HoveredNode.nodeId === selectedNode) {
									let Lable = `${HoveredNode.nodeId} - ${Name}`;
									if (Location.length > 0) Lable += ` (${Location})`;
									$('#zwave-js-selected-node-name').text(Lable);
								}
								HoveredNode.name = Name;
								HoveredNode.location = Location;
							})
							.catch((err) => {
								modalAlert(
									err.responseText || err.message,
									'Could not set Node name and /or location.'
								);
								throw new Error(err.responseText || err.message);
							});
					})
					.catch((err) => {
						modalAlert(
							err.responseText || err.message,
							'Could not set Node name and /or location.'
						);
						throw new Error(err.responseText || err.message);
					});
			}
		};

		const HTML = $('<div>').append('Name: ');
		NN.appendTo(HTML);
		HTML.append(' Location: ');
		NL.appendTo(HTML);

		modalPrompt(HTML, 'Set Node Name & Location', Buttons, true, true);
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
			RED.popover.tooltip(Heal, 'Rebuild Node Routes');
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
		const NameCol = $('<div>')
			.html(node.name)
			.addClass('zwave-js-node-row-name');

		if (node.lastSeen !== 0) {
			const DT = new Date(node.lastSeen);
			RED.popover.tooltip(NameCol, `Last seen: ${DT.toLocaleString()}`);
		} else {
			RED.popover.tooltip(NameCol, `Last seen: Never`);
		}

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
				NameCol,
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
		if (selectedNode === id) return;
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
							`The firmware for node ${nodeId} has been updated. The device will be restarted.`,
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
			DCs.getValueDB.API,
			DCs.getValueDB.name,
			undefined,
			[selectedNode],
			DCs.getValueDB.noWait
		)
			.then(({ object }) => buildPropertyTree(object[0].values))
			.catch((err) => {
				modalAlert(
					err.responseText || err.message,
					'Could not fetch Node properties.'
				);
				throw new Error(err.responseText || err.message);
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
		if (valueIdList.length === 0) {
			updateNodeFetchStatus('No properties found');
			return;
		}
		updateNodeFetchStatus('');

		const CCList = uniqBy(valueIdList, 'commandClass');
		CCList.sort((a, b) => a.commandClassName.localeCompare(b.commandClassName));

		const Data = [];
		CCList.forEach((CC) => {
			Data.push({
				element: renderCommandClassElement(
					CC.commandClass,
					CC.commandClassName
				),
				expanded: false,
				children: []
			});
		});

		const propertyList = $('#zwave-js-node-properties');
		propertyList.treeList('data', Data);

		let Index = 0;
		CCList.forEach((V) => {
			const CCProps = valueIdList.filter(
				(VID) => VID.commandClass === V.commandClass
			);
			CCProps.forEach((Prop) => {
				const Type = Prop.metadata.type;
				const Writeable = Prop.metadata.writeable;
				const CV = Prop.currentValue;

				const Child = renderPropertyElement(Prop);
				propertyList
					.treeList('data')
					[Index].treeList.addChild({ element: Child });

				if (Writeable && Type !== 'any') {
					const icon = Child.prev();
					icon.empty();
					$('<i>')
						.addClass('fa fa-pencil zwave-js-node-property-edit-button')
						.click(() => showEditor(Prop, CV))
						.appendTo(icon);
				}
			});
			Index++;
		});

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

	function splitObject(valueId) {
		// delete normalizedObject
		delete valueId.normalizedObject;

		// Value
		const Value = valueId.currentValue;
		delete valueId.currentValue;

		// Meta
		const MetaData = JSON.parse(JSON.stringify(valueId.metadata));
		delete valueId.metadata;

		return { valueId: valueId, currentValue: Value, metadata: MetaData };
	}

	function renderPropertyElement(valueId) {
		const Split = splitObject(valueId);
		valueId = Split.valueId;

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
		getValue(valueId, Split.metadata, Split.currentValue, el);
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

	function getValue(valueId, metadata, currentValue, el) {
		updateValue({ ...valueId, currentValue }, el);
		if (metadata === undefined) {
			return;
		}
		updateMeta(valueId, metadata, el);
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

	function updateValue(valueId, El) {
		// Assumes you already checked if this applies to selectedNode
		const propertyRow = El || getPropertyRow(valueId);

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
		} else if (valueId.commandClass === 114) {
			// If command class "Manufacturer Specific", show hex values
			propertyValue.text(hexDisplay(value));
			if (valueId.property === 'manufacturerId')
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

			switch (typeof value) {
				case 'object':
					if (Array.isArray(value) && typeof value[0] !== 'object') {
						propertyValue.text(value.join(', '));
					} else {
						propertyValue.text('(Object - Double click)');
					}
					break;

				default:
					propertyValue.text(value);
					break;
			}
		}

		// Some formatting
		if (/^(true|false)$/.test(value)) {
			propertyValue.addClass(`zwave-js-property-value-type-boolean`);
		}

		// Store raw value in data
		propertyValue.data('value', value);
	}

	function updateMeta(valueId, meta = {}, El) {
		// Assumes you already checked if this applies to selectedNode

		const propertyRow = El || getPropertyRow(valueId);
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

		if (El === undefined) {
			const icon = propertyRow.prev();
			icon.empty();
			if (meta.writeable && meta.type !== 'any')
				$('<i>')
					.addClass('fa fa-pencil zwave-js-node-property-edit-button')
					.click(() => showEditor(valueId, value))
					.appendTo(icon);
		}
	}

	function showEditor(valueId, value) {
		const propertyRow = getPropertyRow(valueId);

		// If editor is already displayed, close it instead
		const next = propertyRow.next();
		if (next.is('.zwave-js-node-property-editor')) {
			next.remove();
			return;
		}

		const meta = propertyRow.data('meta');

		const input = $('<input id="zwave-js-value-input">');
		const elementValue = meta.lastSetUIValue || value;
		input.val(elementValue);
		input.attr('value', elementValue);
		input.keyup(() => {
			if (event.which === 13) {
				CommitNewVal();
			}
		});
		let editor;
		function CommitNewVal(val) {
			if (val === undefined) {
				val = input.val();
			}
			if (meta.type === 'number') {
				val = parseInt(val);
			}
			ControllerCMD(
				DCs.setValue.API,
				DCs.setValue.name,
				selectedNode,
				[valueId, val],
				DCs.setValue.noWait
			).catch((err) => {
				modalAlert(err.responseText || err.message, 'Could not set value.');
				throw new Error(err.responseText || err.message);
			});
			meta.lastSetUIValue = val;
			editor.remove();
		}

		if (meta.writeable && meta.type !== 'any') {
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
				if (meta.type === 'number') {
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
				} else if (meta.type === 'boolean') {
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
				} else if (meta.type === 'string') {
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
				} else if (meta.type === 'color') {
					// COLOR
					editor.append(input, makeSetButton());
					input.minicolors();
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
