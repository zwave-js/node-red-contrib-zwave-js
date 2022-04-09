/* eslint-env jquery */
/* eslint-env browser */
/*eslint no-undef: "warn"*/
/*eslint no-unused-vars: "warn"*/

/* UI Inclusion Functions */
let StartInclusionExclusion;
let StartReplace;
let GrantSelected;
let ValidateDSK;
let DriverReady = false;
const WindowSize = { w: 600, h: 500 };

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
	let ExpandCC = false; // Expand CC's
	let Timer; // Timers
	let IETime; // IE Time
	let SecurityTime; // Security Time
	const BatteryUIElements = {}; // Battery Icon Elements
	let BA = undefined; // Node Button Array
	let HoveredNode = undefined; // Hovered Node
	let selectedNode; // Selected Node

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

		$('<div>')
			.css({ padding: 10, maxWidth: 500, wordWrap: 'break-word' })
			.html(message)
			.dialog(Options);
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
			`<div style="width:430px; margin:auto;margin-top:40px;font-size:18px">Running Health Check. This may take a few minutes, please wait...${P}%</div>`
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

		RED.comms.unsubscribe('/zwave-js/healthcheck', processHealthResults);
		RED.comms.unsubscribe(
			'/zwave-js/healthcheckprogress',
			processHealthCheckProgress
		);
	}

	function RenderHealthCheck(Rounds) {
		const Options = {
			draggable: false,
			modal: true,
			resizable: false,
			width: WindowSize.w,
			height: WindowSize.h,
			title: 'Node Health Check : Node ' + HoveredNode.nodeId,
			minHeight: 75,
			buttons: {
				Abort: function () {
					RED.comms.unsubscribe('/zwave-js/healthcheck', processHealthResults);
					RED.comms.unsubscribe(
						'/zwave-js/healthcheckprogress',
						processHealthCheckProgress
					);
					$(this).dialog('destroy');
				}
			}
		};

		HCForm = $('<div>')
			.css({ padding: 10 })
			.html(
				'<div style="width:430px; margin:auto;margin-top:40px;font-size:18px">Running Health Check. This may take a few minutes, please wait...0%</div>'
			);

		HCForm.dialog(Options);

		RED.comms.subscribe('/zwave-js/healthcheck', processHealthResults);
		RED.comms.subscribe(
			'/zwave-js/healthcheckprogress',
			processHealthCheckProgress
		);

		HCRounds = Rounds;

		ControllerCMD(
			'DriverAPI',
			'checkLifelineHealth',
			undefined,
			[HoveredNode.nodeId, Rounds],
			true
		);
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
			ControllerCMD('ControllerAPI', 'abortFirmwareUpdate', undefined, [
				HoveredNode.nodeId
			]).then(() => {
				FirmwareForm.dialog('destroy');
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
				url: `zwave-js/firmwareupdate/${btoa(Code)}`,
				method: 'POST',
				contentType: 'application/octect-stream',
				data: array,
				processData: false
			};
			$.ajax(Options)
				.then(() => {
					FWRunning = true;
					selectNode(NID);
					$(":button:contains('Close')")
						.prop('disabled', true)
						.addClass('ui-state-disabled');
					$(":button:contains('Begin Update')")
						.prop('disabled', true)
						.addClass('ui-state-disabled');
					$('#progressbar').css({ display: 'block' });
				})
				.catch((err) => {
					modalAlert(err.responseText, 'Firmware Rejected');
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
				Abort: AbortUpdate,
				Close: function () {
					$(this).dialog('destroy');
				}
			}
		};

		FirmwareForm = $('<div>').css({ padding: 10 }).html('Please wait...');
		FirmwareForm.dialog(Options);

		$.getJSON('zwave-js/cfg-nodelist', (data) => {
			FirmwareForm.html('');
			const Template = $('#TPL_Firmware').html();
			const templateScript = Handlebars.compile(Template);
			const HTML = templateScript({ nodes: data });
			FirmwareForm.append(HTML);
			$('#progressbar').css({ display: 'none' });
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

				ControllerCMD('AssociationsAPI', 'addAssociations', undefined, PL)
					.then(() => {
						GMGroupSelected();
					})
					.catch((err) => {
						modalAlert(err.responseText, 'Association could not be added.');
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
				ControllerCMD('AssociationsAPI', 'removeAssociations', undefined, PL)
					.then(() => {
						GMGroupSelected();
					})
					.catch((err) => {
						modalAlert(err.responseText, 'Association Removal Failed');
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

		ControllerCMD('AssociationsAPI', 'getAssociations', undefined, [AA]).then(
			({ object }) => {
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
			}
		);
	}

	function AssociationMGMT() {
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

		ControllerCMD('AssociationsAPI', 'getAllAssociationGroups', undefined, [
			HoveredNode.nodeId
		]).then(({ object }) => {
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
		});
	}

	async function GenerateMapJSON(Nodes) {
		const _Elements = [];

		return new Promise(function (res, rej) {
			ControllerCMD(
				'DriverAPI',
				'getNodeStatistics',
				undefined,
				undefined
			).then(({ object }) => {
				Nodes.forEach((N) => {
					if (N.isControllerNode) {
						const EL = {
							data: {
								id: N.nodeId,
								name: 'Controller',
								fontSize: '12px',
								icon: 'resources/node-red-contrib-zwave-js/UITab/Stick.png'
							}
						};
						_Elements.push(EL);
					} else {
						const EL = {
							data: {
								id: N.nodeId,
								name: `${N.nodeId} - ${N.nodeName || 'No Name'}`,
								fontSize: '10px',
								icon: 'resources/node-red-contrib-zwave-js/UITab/Device.png'
							}
						};

						_Elements.push(EL);

						if (object[N.nodeId.toString()].lwr !== undefined) {
							const Stats = object[N.nodeId].lwr;
							if (Stats.repeaters.length > 0) {
								let First = true;
								let Last = undefined;
								Stats.repeaters.reverse().forEach((R) => {
									if (First) {
										const EL = {
											data: {
												id: `${N.nodeId}.${R}`,
												source: N.nodeId,
												target: R,
												color: '#0000FF'
											}
										};
										_Elements.push(EL);
										First = false;
										Last = R;
									} else {
										const EL = {
											data: {
												id: `${Last}.${R}`,
												source: Last,
												target: R,
												color: '#0000FF'
											}
										};
										_Elements.push(EL);
										Last = R;
									}
								});
							} else {
								const EL = {
									data: {
										id: `${N.nodeId}.1`,
										source: N.nodeId,
										target: 1,
										color: '#00FF00'
									}
								};
								_Elements.push(EL);
							}
						} else {
							const EL = {
								data: {
									id: `${N.nodeId}.1`,
									source: N.nodeId,
									target: 1,
									color: '#FF0000'
								}
							};
							_Elements.push(EL);
						}
					}
				});
				res(_Elements);
			});
		});
	}

	function NetworkMap() {
		let Mesh;

		const Options = {
			draggable: true,
			modal: true,
			resizable: true,
			width: WindowSize.w,
			height: WindowSize.h,
			title: 'ZWave Network Mesh',
			minHeight: 75,
			buttons: {
				Close: function () {
					$(this).dialog('destroy');
				}
			}
		};

		const Window = $('<div>')
			.css({ padding: 10 })
			.html('Generating Network Topology Map...');
		Window.dialog(Options);
		Window.on('dialogclose', () => {});

		ControllerCMD('ControllerAPI', 'getNodes').then(({ object }) => {
			GenerateMapJSON(object).then((Elements) => {
				const StyleSheet = cytoscape.stylesheet();

				// Node
				StyleSheet.selector('node').css({
					'font-size': 'data(fontSize)',
					width: '50px',
					height: '50px',
					'background-image': 'data(icon)',
					'background-color': 'white',
					'background-fit': 'cover cover',
					label: 'data(name)'
				});

				// Edge
				StyleSheet.selector('egde').css({
					'curve-style': 'taxi',
					'taxi-direction': 'auto',
					'taxi-turn': 20,
					'taxi-turn-min-distance': 5,
					'target-arrow-shape': 'triangle',
					'line-color': 'data(color)'
				});

				const Template = $('#TPL_Map').html();
				const templateScript = Handlebars.compile(Template);
				const HTML = templateScript({});

				Window.html('');
				Window.append(HTML);

				const data = {
					layout: {
						name: 'cose',
						animate: false
					},
					container: $('#NetworkMesh')[0],
					style: StyleSheet,
					elements: Elements
				};
				console.log(data);
				Mesh = cytoscape(data);
			});
		});
	}

	let controllerOpts;
	let nodeOpts;

	function CheckDriverReady() {
		const Options = {
			url: `zwave-js/driverready`,
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
			url: `zwave-js/cmd`,
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

	function GetNodes() {
		BA = undefined;
		ControllerCMD('ControllerAPI', 'getNodes')
			.then(({ object }) => {
				const controllerNode = object.filter((N) => N.isControllerNode);
				if (controllerNode.length > 0) {
					makeInfo(
						'#zwave-js-controller-info',
						controllerNode[0].deviceConfig,
						controllerNode[0].firmwareVersion
					);
				}
				$('#zwave-js-node-list')
					.empty()
					.append(
						object
							.filter((node) => node && !node.isControllerNode)
							.map(renderNode)
					);
			})
			.catch((err) => {
				console.error(err);
			});

		$('#zwave-js-node-properties > div > div > div > ol').empty();
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

		$(B).html('Please wait...');
		ClearIETimer();
		ClearSecurityCountDown();
		$(B).prop('disabled', true);

		ControllerCMD('IEAPI', 'verifyDSK', undefined, [$('#SC_DSK').val()], true);
	};

	GrantSelected = () => {
		const B = event.target;

		$(B).html('Please wait...');
		ClearIETimer();
		ClearSecurityCountDown();
		$(B).prop('disabled', true);

		const Granted = [];
		$('.SecurityClassCB').each(function () {
			if ($(this).is(':checked')) {
				Granted.push(parseInt($(this).attr('id').replace('SC_', '')));
			}
		});
		ControllerCMD('IEAPI', 'grantClasses', undefined, [Granted], true);
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

		ControllerCMD('IEAPI', 'replaceNode', undefined, [
			parseInt(HoveredNode.nodeId),
			Request
		]).catch((err) => {
			if (err.status !== 504) {
				modalAlert(err.responseText, 'Could Not Replace Node');
				$(B).html(OT);
				$(B).prop('disabled', false);
			}
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
					url: 'zwave-js/smart-start-list',
					method: 'GET',
					dataType: 'json',
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
											'IEAPI',
											'unprovisionSmartStartNode',
											undefined,
											[Entry.dsk],
											true
										);
										Item.remove();
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
				ControllerCMD('IEAPI', 'checkKeyReq', undefined, [1]).catch((err) => {
					if (err.status !== 504) {
						modalAlert(err.responseText, 'Could Not Start Inclusion');
						$(B).html(OT);
						$(B).prop('disabled', false);
					} else {
						$('#SmartStartCommit').css({ display: 'inline' });
						$.ajax({
							url: `zwave-js/smartstart/startserver`,
							method: 'GET',
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
					'IEAPI',
					'beginExclusion',
					undefined,
					[$('#ERP').is(':checked')],
					true
				);
				return;
		}

		ControllerCMD('IEAPI', 'beginInclusion', undefined, [Request]).catch(
			(err) => {
				if (err.status !== 504) {
					modalAlert(err.responseText, 'Could Not Start Inclusion');
					$(B).html(OT);
					$(B).prop('disabled', false);
				}
			}
		);
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
									'IEAPI',
									'unprovisionAllSmartStart',
									undefined,
									undefined,
									true
								);
								ParentDialog.dialog('destroy');
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
					text: 'Abort',
					click: function () {
						$.ajax({
							url: `zwave-js/smartstart/stopserver`,
							method: 'GET'
						});
						ClearIETimer();
						ClearSecurityCountDown();
						ControllerCMD('IEAPI', 'stop', undefined, undefined, true);
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
						ControllerCMD('IEAPI', 'commitScans', undefined, Entries, true);
						$.ajax({
							url: `zwave-js/smartstart/stopserver`,
							method: 'GET'
						});
						StepsAPI.setStepIndex(StepList.SmartStartDone);
						$('#SmartStartCommit').css({ display: 'none' });
						$('#IEButton').css({ display: 'none' });
						$('#IEClose').css({ display: 'inline-block' });
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
					text: 'Abort',
					click: function () {
						ControllerCMD('IEAPI', 'stop', undefined, undefined, true);
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
			'ControllerAPI',
			'healNode',
			undefined,
			[HoveredNode.nodeId],
			true
		);
	}

	function StartHeal() {
		ControllerCMD(
			'ControllerAPI',
			'beginHealingNetwork',
			undefined,
			undefined,
			true
		);
	}

	function StopHeal() {
		ControllerCMD(
			'ControllerAPI',
			'stopHealingNetwork',
			undefined,
			undefined,
			true
		);
	}

	function Reset() {
		const Buttons = {
			'Yes - Reset': function () {
				ControllerCMD('ControllerAPI', 'hardReset').then(() => {
					modalAlert('Your Controller has been reset.', 'Reset Complete');
					GetNodes();
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
		ControllerCMD('ControllerAPI', 'refreshInfo', undefined, [
			HoveredNode.nodeId
		]).catch((err) => {
			if (err.status !== 504) {
				modalAlert(err.responseText, 'Interview Error');
			}
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
				Removing = true;
				ControllerCMD('ControllerAPI', 'removeFailedNode', undefined, [
					HoveredNode.nodeId
				]).catch((err) => {
					if (err.status !== 504) {
						modalAlert(err.responseText, 'Could Not Remove Node');
					}

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
						//menuOptionMenu.collapse();
					}
				},
				{
					id: 'controller-option-menu-start-heal',
					label: 'Begin Network Heal',
					onselect: function () {
						IsDriverReady();
						StartHeal();
						// menuOptionMenu.collapse();
					}
				},
				{
					id: 'controller-option-menu-stop-heal',
					label: 'Stop Network Heal',
					onselect: function () {
						IsDriverReady();
						StopHeal();
						// menuOptionMenu.collapse();
					}
				},
				{
					id: 'controller-option-menu-firmware',
					label: 'Node Firmware Updater',
					onselect: function () {
						IsDriverReady();
						FirmwareUpdate();
						//	menuOptionMenu.collapse();
					}
				},
				{
					id: 'controller-option-menu-reset',
					label: 'Reset Controller',
					onselect: function () {
						Reset();
						//	menuOptionMenu.collapse();
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

		// Controller Options
		controllerOpts = $('<div>').appendTo(controllerHeader);

		// Info
		$('<div id="zwave-js-controller-info">')
			.addClass('zwave-js-info-box')
			.css({ fontWeight: 'bold' })
			.appendTo(controllerOpts);
		$('<div id="zwave-js-controller-status">')
			.addClass('zwave-js-info-box')
			.html('Waiting for driver...')
			.appendTo(controllerOpts);

		const BA = $('<div>');
		BA.css({ width: '200px', marginLeft: '6px', bbackgroundColor: 'inherit' });
		BA.appendTo(controllerOpts);

		// Expand
		const Expand = $('<button>');
		Expand.click(() => {
			if (ExpandCC) {
				ExpandCC = false;
				Expand.find('i').removeClass('fa-check-square-o');
				Expand.find('i').addClass('fa-square-o');
			} else {
				ExpandCC = true;
				Expand.find('i').addClass('fa-check-square-o');
				Expand.find('i').removeClass('fa-square-o');
			}
		});
		Expand.addClass('red-ui-button red-ui-button-small');
		Expand.css({ width: '30px', height: '30px', marginRight: '5px' });
		Expand.append('<i class="fa fa-square-o fa-lg"></i>');
		RED.popover.tooltip(Expand, "Expand CC's");
		BA.append(Expand);

		// Include Exclude
		const IE = $('<button>');
		IE.click(() => {
			IsDriverReady();
			ShowIncludeExcludePrompt();
		});
		IE.addClass('red-ui-button red-ui-button-small');
		IE.css({ width: '30px', height: '30px', marginRight: '1px' });
		IE.append('<i class="fa fa-wifi fa-lg"></i>');
		RED.popover.tooltip(IE, 'Include/Exclude');
		BA.append(IE);

		// Map
		const Heal = $('<button>');
		Heal.click(() => {
			IsDriverReady();
			NetworkMap();
		});
		Heal.addClass('red-ui-button red-ui-button-small');
		Heal.css({ width: '30px', height: '30px', marginRight: '1px' });
		Heal.append('<i class="fa fa-globe fa-lg"></i>');
		RED.popover.tooltip(Heal, 'Network Map');
		BA.append(Heal);

		// Monitor
		const Monitor = $('<button>');
		Monitor.click(() => {
			ShowCommandViewer();
		});
		Monitor.addClass('red-ui-button red-ui-button-small');
		Monitor.css({ width: '30px', height: '30px', marginRight: '1px' });
		Monitor.append('<i class="fa fa-bug fa-lg"></i>');
		RED.popover.tooltip(Monitor, 'UI Command Monitor');
		BA.append(Monitor);

		// Other
		const OtherBTN = $('<button>');
		OtherBTN.click(() => {
			ShowOtherControllolerMenu(OtherBTN);
		});
		OtherBTN.addClass('red-ui-button red-ui-button-small');
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
		const nodeHeader = $('<div>', {
			class: 'red-ui-palette-header red-ui-info-header'
		})
			.css({ flex: '0 0 auto' })
			.appendTo(nodePanel);

		nodeOpts = $('<div>').appendTo(nodeHeader); //.hide();

		// Info
		$('<div id="zwave-js-selected-node-info">')
			.addClass('zwave-js-info-box')
			.css({ fontWeight: 'bold' })
			.appendTo(nodeOpts);
		$('<div id="zwave-js-selected-node-name">')
			.addClass('zwave-js-info-box')
			.appendTo(nodeOpts);

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
		RED.comms.subscribe(`/zwave-js/cmd`, handleControllerEvent);
		RED.comms.subscribe(`/zwave-js/battery`, handleBattery);
		RED.comms.subscribe(`/zwave-js/status`, handleStatusUpdate);

		$('#zwave-js-selected-node-info').text('No Node Selected');
		$('#zwave-js-selected-node-name').text('No Node Selected');

		setTimeout(WaitLoad, 100);
	}
	// Init done

	function WaitLoad() {
		CheckDriverReady().then(({ ready }) => {
			if (ready) {
				DriverReady = true;
				getLatestStatus();
				GetNodes();
			} else {
				setTimeout(WaitLoad, 5000);
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
						GetNodes();
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

	function ShowOtherNodeMenu(button) {
		const menuOptionMenu = RED.menu.init({
			id: 'node-option-menu',
			options: [
				{
					id: 'node-option-menu-interview',
					label: 'Reinterview Node',
					onselect: function () {
						IsDriverReady();
						IsNodeReady(HoveredNode);
						InterviewNode();
					}
				},
				{
					id: 'node-option-menu-remove',
					label: 'Remove Failed Node',
					onselect: function () {
						IsDriverReady();
						RemoveFailedNode();
						//menuOptionMenu.collapse();
					}
				},
				{
					id: 'node-option-menu-replace',
					label: 'Replace Failed Node',
					onselect: function () {
						IsDriverReady();
						ShowReplacePrompt();
						//	menuOptionMenu.collapse();
					}
				},
				{
					id: 'node-option-menu-heal',
					label: 'Run Health Check',
					onselect: function () {
						IsDriverReady();
						IsNodeReady(HoveredNode);
						HealthCheck();
					}
				},
				{
					id: 'node-option-menu-db',
					label: 'View In Device Browser',
					onselect: function () {
						IsDriverReady();
						IsNodeReady(HoveredNode);
						OpenDB();
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

	function NameNode() {
		const Name = prompt('Please enter Node Name', HoveredNode.name);
		if (!Name) {
			return;
		}
		const Location = prompt('Please enter Node Location', HoveredNode.location);

		ControllerCMD('ControllerAPI', 'setNodeName', undefined, [
			HoveredNode.nodeId,
			Name
		]).then(() => {
			ControllerCMD('ControllerAPI', 'setNodeLocation', undefined, [
				HoveredNode.nodeId,
				Location
			]).then(() => {
				$(`.zwave-js-node-row[data-nodeid='${HoveredNode.nodeId}']`)
					.find('.zwave-js-node-row-name')
					.html(Name);
				if (HoveredNode.nodeId == selectedNode) {
					let Lable = `${HoveredNode.nodeId} - ${Name}`;
					if (Location.length > 0) Lable += ` (${Location})`;
					$('#zwave-js-selected-node-name').html(Lable);
				}
				HoveredNode.name = Name;
				HoveredNode.location = Location;
			});
		});
	}

	function AddOverlayNodeButtons(Node, Row) {
		if (Node !== undefined) {
			HoveredNode = Node;
		}

		console.log(HoveredNode);
		console.log(BA);

		if (BA === undefined) {
			BA = $('<div>');
			BA.css({
				position: 'absolute',
				width: '200px',
				left: '10px',
				backgroundColor: 'inherit'
			});

			const Select = $('<button>');
			Select.click(() => {
				IsNodeReady(HoveredNode);
				selectNode(HoveredNode.nodeId);
			});
			Select.addClass('red-ui-button red-ui-button-small');
			Select.css({ width: '30px', height: '30px', marginRight: '5px' });
			Select.append('<i class="fa fa-info fa-lg"></i>');
			RED.popover.tooltip(Select, 'Node Details');
			BA.append(Select);

			const NameLocation = $('<button>');
			NameLocation.click(() => {
				IsNodeReady(HoveredNode);
				NameNode();
			});
			NameLocation.addClass('red-ui-button red-ui-button-small');
			NameLocation.css({ width: '30px', height: '30px', marginRight: '1px' });
			NameLocation.append('<i class="fa fa-pencil fa-lg"></i>');
			RED.popover.tooltip(NameLocation, 'Edit Name / Location');
			BA.append(NameLocation);

			const Heal = $('<button>');
			Heal.click(() => {
				IsNodeReady(HoveredNode);
				StartNodeHeal();
			});
			Heal.addClass('red-ui-button red-ui-button-small');
			Heal.css({ width: '30px', height: '30px', marginRight: '1px' });
			Heal.append('<i class="fa fa-medkit fa-lg"></i>');
			RED.popover.tooltip(Heal, 'Heal Node');
			BA.append(Heal);

			const Associations = $('<button>');
			Associations.click(() => {
				HoveredNode.ready;
				IsNodeReady(HoveredNode);
				AssociationMGMT();
			});
			Associations.addClass('red-ui-button red-ui-button-small');
			Associations.css({ width: '30px', height: '30px', marginRight: '1px' });
			Associations.append('<i class="fa fa-code-fork fa-lg"></i>');
			RED.popover.tooltip(Associations, 'Association Management');
			BA.append(Associations);

			const OtherBTN = $('<button>');
			OtherBTN.click(() => {
				ShowOtherNodeMenu(OtherBTN);
			});
			OtherBTN.addClass('red-ui-button red-ui-button-small');
			OtherBTN.css({ width: '30px', height: '30px', marginRight: '1px' });
			OtherBTN.append('<i class="fa fa-caret-down fa-lg"></i>');
			RED.popover.tooltip(OtherBTN, 'Other Actions');
			BA.append(OtherBTN);

			Row.append(BA);
		} else {
			if (Node === undefined && Row === undefined) {
				BA.css({
					position: 'absolute',
					width: '200px',
					left: '10px',
					display: 'none',
					backgroundColor: 'inherit'
				});
				return;
			}

			BA.css({
				position: 'absolute',
				width: '200px',
				left: '10px',
				display: 'block',
				backgroundColor: 'inherit'
			});
			Row.append(BA);
		}
	}

	function renderNode(node) {
		return $('<div>')
			.addClass('red-ui-treeList-label zwave-js-node-row')
			.attr('data-nodeid', node.nodeId)
			.data('info', node)
			.hover(
				function () {
					AddOverlayNodeButtons(node, $(this));
				},
				function () {
					AddOverlayNodeButtons();
				}
			)
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

		el.empty().append(
			$('<span>').text(
				`${deviceConfig.manufacturer} | ${deviceConfig.label} | FW: ${firmwareVersion}`
			)
		);
	}

	function deselectCurrentNode() {
		// "Disconnect" from previously selected node
		if (selectedNode) {
			$(`#zwave-js-node-list [data-nodeid='${selectedNode}']`).removeClass(
				'selected'
			);

			$('#zwave-js-status-box-interview').text('');

			$('#zwave-js-node-properties').treeList('empty');
			RED.comms.unsubscribe(`/zwave-js/cmd/${selectedNode}`, handleNodeEvent);
		}
	}

	function selectNode(id) {
		if (selectedNode == id) return;
		deselectCurrentNode();

		selectedNode = id;

		const selectedEl = $(`#zwave-js-node-list [data-nodeid='${id}']`);
		selectedEl.addClass('selected');
		//$('#zwave-js-selected-node-id').text(selectedNode);
		const info = selectedEl.data('info');

		makeInfo(
			'#zwave-js-selected-node-info',
			info.deviceConfig,
			info.firmwareVersion
		);

		let Name = `${selectedNode} - ${
			info.name !== undefined && info.name.length > 0 ? info.name : 'No Name'
		}`;

		if (info.location !== undefined && info.location.length > 0)
			Name += ` (${info.location})`;

		$('#zwave-js-selected-node-name').text(Name);

		getProperties();
		RED.comms.subscribe(`/zwave-js/cmd/${selectedNode}`, handleNodeEvent);
	}

	function handleNodeEvent(topic, data) {
		const nodeId = topic.split('/')[3];

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
				$('#progressbar > div').css({ width: `${Percent}%` });
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
			{
				label: text,
				class: 'zwave-js-node-fetch-status'
			}
		]);
	}

	function getProperties() {
		updateNodeFetchStatus('Fetching properties...');

		ControllerCMD('ValueAPI', 'getDefinedValueIDs', selectedNode).then(
			({ object }) => buildPropertyTree(object)
		);
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
					expanded: ExpandCC,
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
		ControllerCMD('ValueAPI', 'getValue', selectedNode, [valueId]).then(
			({ node, object }) => {
				if (node != selectedNode) {
					return;
				}
				updateValue({ ...valueId, currentValue: object.currentValue });
				ControllerCMD('ValueAPI', 'getValueMetadata', selectedNode, [
					valueId
				]).then(({ node, object }) => {
					if (!object.metadata || node != selectedNode) {
						return;
					}
					updateMeta(valueId, object.metadata);
				});
			}
		);
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
			valueId?.newValue ??
			valueId?.currentValue ??
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
		if (meta?.states?.[value]) {
			propertyValue.text(meta?.states?.[value]);
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
			ControllerCMD('ValueAPI', 'setValue', selectedNode, [valueId, val], true);
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
			url: `zwave-js/fetch-driver-status`,
			method: 'GET'
		});
	}

	return { init: init, ControllerCMD: ControllerCMD };
})();
