/* eslint-disable prefer-const */
/* eslint-env jquery */
/* eslint-env browser */
/* eslint no-undef: "warn"*/
/* eslint no-unused-vars: "warn"*/

// UI Function placholders
let IE;
let Grant;
let ValidateDSK;

// Globals
const StepList = {
	IEMode: 0,
	NIF: 1,
	Grant: 2,
	DSK: 3,
	Added: 4,
	Removed: 5
};

const S2Classes = {
	'-1': 'None',
	0: 'S2 Unauthenticated',
	1: 'S2 Authenticated',
	2: 'S2 AccessControl',
	7: 'S0 Legacy'
};

const modalWidth = 800;
const modalHeight = 600;

const ZWaveJSUI = (function () {
	// Vars
	let networkId;
	let stepsAPI;
	let clientSideAuth = false;

	// Prompt
	const prompt = async (Message, Buttons, NoCancel = false) => {
		return new Promise((resolve) => {
			Prompt = $('<div>');
			Prompt.append(Message);

			const Options = {
				title: 'Question',
				buttons: [],
				draggable: false,
				resizable: false,
				modal: true
			};

			if (!NoCancel) {
				Options.buttons.push({
					text: 'Cancel',
					click: function () {
						resolve(-1);
						$(this).dialog('close');
					}
				});
			}
			Buttons.forEach(function (V, I) {
				Options.buttons.push({
					text: V,
					click: function () {
						resolve(I);
						$(this).dialog('close');
					}
				});
			});

			Prompt.dialog(Options);
		});
	};

	// Runtime Communication Methods
	const Runtime = {
		Get: async function (API, Method, URL) {
			return new Promise((resolve) => {
				$.ajax({
					type: 'GET',
					url: URL || `zwave-js/ui/${networkId}/${API}/${Method}`,
					success: (data) => resolve(data),
					error: (jqXHR, textStatus, errorThrown) =>
						resolve({ callSuccess: false, response: `${textStatus}: ${errorThrown}` }),
					dataType: 'json'
				});
			});
		},
		Post: async function (API, Method, Data, URL) {
			return new Promise((resolve) => {
				$.ajax({
					type: 'POST',
					data: JSON.stringify(Data),
					url: URL || `zwave-js/ui/${networkId}/${API}/${Method}`,
					success: (data) => resolve(data),
					error: (jqXHR, textStatus, errorThrown) =>
						resolve({ callSuccess: false, response: `${textStatus}: ${errorThrown}` }),
					dataType: 'json',
					contentType: 'application/json'
				});
			});
		}
	};

	// Node Managemnt fucntions
	Grant = () => {
		const GrantObject = {
			securityClasses: [],
			clientSideAuth: clientSideAuth
		};

		$(':checkbox:checked').each(function () {
			GrantObject.securityClasses.push(parseInt($(this).val()));
		});

		Runtime.Post(undefined, undefined, [GrantObject], `zwave-js/ui/${networkId}/s2/grant`)
			.then((data) => {
				// wait?
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	ValidateDSK = () => {
		Runtime.Post(undefined, undefined, [$('#DSK').val()], `zwave-js/ui/${networkId}/s2/dsk`)
			.then((data) => {
				// Wait?
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	IE = (Mode) => {
		let Request;

		if (Mode === 'EX') {
			prompt(
				'If the device you wish to exclude is found on the Smart Start Provisioning List, would you like it to be removed?',
				['Yes', 'No']
			).then((answer) => {
				Request = {
					strategy: answer === 0 ? 2 : 0
				};
				Runtime.Post('CONTROLLER', 'beginExclusion', [Request]).then((data) => {
					if (data.callSuccess) {
						stepsAPI.setStepIndex(StepList.NIF);
					} else {
						alert(data.response);
					}
				});
			});
		}

		if (Mode === 'Default') {
			prompt(
				"If the device you're including does not support S2, S0 will be used ONLY if its necessary. Would you like to fallback to S0 regarldess?",
				['Yes', 'No']
			).then((answer) => {
				if (answer > -1) {
					Request = {
						strategy: 0,
						forceSecurity: answer === 0
					};
					Runtime.Post('CONTROLLER', 'beginInclusion', [Request]).then((data) => {
						if (data.callSuccess) {
							stepsAPI.setStepIndex(StepList.NIF);
						} else {
							alert(data.response);
						}
					});
				}
			});
		}

		if (Mode === 'S2') {
			Request = {
				strategy: 4
			};
			Runtime.Post('CONTROLLER', 'beginInclusion', [Request]).then((data) => {
				if (data.callSuccess) {
					stepsAPI.setStepIndex(StepList.NIF);
				} else {
					alert(data.response);
				}
			});
		}

		if (Mode === 'S0') {
			Request = {
				strategy: 3
			};
			Runtime.Post('CONTROLLER', 'beginInclusion', [Request]).then((data) => {
				if (data.callSuccess) {
					stepsAPI.setStepIndex(StepList.NIF);
				} else {
					alert(data.response);
				}
			});
		}

		if (Mode === 'NS') {
			Request = {
				strategy: 2
			};
			Runtime.Post('CONTROLLER', 'beginInclusion', [Request]).then((data) => {
				if (data.callSuccess) {
					stepsAPI.setStepIndex(StepList.NIF);
				} else {
					alert(data.response);
				}
			});
		}
	};

	// Show Include Options
	const showNetworkManagement = () => {
		const HTML = $('#TPL_NetworkManagement').html();
		const Panel = $('<div>');
		Panel.append(HTML);

		const Settings = {
			title: 'Network Management',
			modal: true,
			width: modalWidth,
			height: modalHeight,
			resizable: false,
			draggable: false,
			close: function () {
				Panel.remove();
			}
		};

		Panel.dialog(Settings);
		$('#TPL_NetworkManagementTabs').tabs().addClass('zwave-js-vertical-tabs ui-helper-clearfix');
		$('#TPL_NetworkManagementTabs li').removeClass('ui-corner-top').addClass('ui-corner-left');

		// Basic CI Info
		Runtime.Get('CONTROLLER', 'getNodes').then((data) => {
			if (data.callSuccess) {
				const Controller = data.response.Event.eventBody.find((N) => N.isControllerNode);

				const CITable = $('#CITable');
				CITable.append(`<tr><td>Device</td><td>${Controller.deviceConfig.description}</td>`);
				CITable.append(`<tr><td>Manufacturer</td><td>${Controller.deviceConfig.manufacturer}</td>`);
				CITable.append(`<tr><td>Firmware Version</td><td>${Controller.firmwareVersion}</td>`);
				CITable.append(`<tr><td>Supported Data Rates</td><td>${Controller.supportedDataRates.toString()}</td>`);

				const CIStatsTable = $('#CIStatsTable');
				for (const [key, value] of Object.entries(Controller.statistics)) {
					CIStatsTable.append(`<tr><td>${key}</td><td>${value}</td>`);
				}
			} else {
				alert(data.response);
			}
		});

		// Power Level
		Runtime.Get('CONTROLLER', 'getPowerlevel').then((data) => {
			if (data.callSuccess) {
				$('#CSettings_PL').val(data.response.powerlevel);
				$('#CSettings_0DBM').val(data.response.measured0dBm);
			} else {
				alert(data.response);
			}
		});

		// Region
		Runtime.Get('CONTROLLER', 'getRFRegion').then((data) => {
			if (data.callSuccess) {
				//
			} else {
				$('#CSettings_Regions').prop('disabled', 'disabled');
			}
		});

		const Steps = $('#IEWizard').steps({ showFooterButtons: false });
		stepsAPI = Steps.data('plugin_Steps');
	};

	const showNodeManagement = () => {
		const HTML = $('#TPL_NodeManagement').html();
		const Panel = $('<div>');
		Panel.append(HTML);

		const Settings = {
			title: 'Node Management',
			modal: true,
			width: modalWidth,
			height: modalHeight,
			resizable: false,
			draggable: false,
			close: function () {
				Panel.remove();
			}
		};

		Panel.dialog(Settings);
		$('#TPL_NodeManagementTabs').tabs().addClass('zwave-js-vertical-tabs ui-helper-clearfix');
		$('#TPL_NodeManagementTabs li').removeClass('ui-corner-top').addClass('ui-corner-left');
	};

	// Network Selecetd
	const networkSelected = function () {
		// Remove Subscriptions
		if (networkId) {
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/status`);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/s2/grant`);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/s2/dsk`);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/added`);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/removed`);
			networkId = undefined;
		}

		networkId = this.value;

		// get Nodes ansd Info
		Runtime.Get('CONTROLLER', 'getNodes').then((data) => {
			if (data.callSuccess) {
				data = data.response.Event.eventBody;

				const Controller = data.filter((N) => N.isControllerNode)[0];
				$('#zwavejs-radio-model').text(Controller.deviceConfig.label);
				$('#zwavejs-radio-manufacture').text(`${Controller.deviceConfig.manufacturer}, `);
				$('#zwavejs-radio-version').text(`v${Controller.firmwareVersion}, `);

				const Nodes = data.filter((N) => !N.isControllerNode);

				// Render List
				const TreeData = [];
				Nodes.forEach((N) => {
					TreeData.push({
						label: `${N.nodeId} - ${N.nodeName || N.deviceConfig.label}`,
						nodeData: N
						//icon: 'fa fa-circle'
					});
				});
				$('#zwavejs-node-list').treeList('data', TreeData);
			} else {
				alert(data.response);
			}
		});

		$.getJSON(`zwave-js/ui/${networkId}/status`, (data) => {
			$('#zwavejs-radio-status').text(data.status);
		});

		// subscribe

		/* Status */
		RED.comms.subscribe(`zwave-js/ui/${networkId}/status`, (event, data) => {
			$('#zwavejs-radio-status').text(data.status);
		});

		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/added`, (event, data) => {
			const NodeID = data.nodeId;
			const HSC = data.highestSecurityClass;
			const LS = data.lowSecurity;

			let Message = `The Node was successfully added to the network.<br />It will now be interviewed!<br /><br /><strong>Node ID:</strong> ${NodeID}, <strong>Security Mode:</strong> ${S2Classes[HSC]}`;

			if (LS) {
				Message += ' (lower than requested)';
				$('#NodeAddedIcon').css({ color: 'orange' });
				$('#NodeAddedIcon').addClass('fa-exclamation-triangle');
			} else {
				$('#NodeAddedIcon').addClass('fa-check-circle');
			}

			$('#NodeAddedMessage').html(Message);
			stepsAPI.setStepIndex(StepList.Added);
		});

		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/removed`, (event, data) => {
			stepsAPI.setStepIndex(StepList.Removed);
		});

		/* S2 Grant */
		RED.comms.subscribe(`zwave-js/ui/${networkId}/s2/grant`, (event, data) => {
			clientSideAuth = data.clientSideAuth;
			data.securityClasses.forEach((SC) => {
				$('#S2ClassesTable').append(
					`<tr><td>${S2Classes[SC]}</td><td><input type="checkbox" value="${SC}" class="S2Class" /></td></tr>`
				);
			});
			stepsAPI.setStepIndex(StepList.Grant);
		});

		/* S2 DSk */
		RED.comms.subscribe(`zwave-js/ui/${networkId}/s2/dsk`, (event, data) => {
			const Parts = data.dsk.split('-');
			for (let i = 1; i < Parts.length; i++) {
				$(`#DSK_Hint${i}`).val(Parts[i]);
			}
			stepsAPI.setStepIndex(StepList.DSK);
		});
	};

	// Node Selected
	const nodeSelected = (event, item) => {
		$('#zwavejs-node-model').text(
			`${item.nodeData.nodeId} - ${item.nodeData.nodeName || item.nodeData.deviceConfig.label}`
		);
		$('#zwavejs-node-manufacture').text(`${item.nodeData.deviceConfig.manufacturer}, `);
		$('#zwavejs-node-version').text(`${item.nodeData.firmwareVersion}, `);
		$('#zwavejs-node-status').text(`${item.nodeData.status}`);

		Runtime.Post('CONTROLLER', 'getValueDB', [item.nodeData.nodeId]).then((data) => {
			if (data.callSuccess) {
				data = data.response.Event.eventBody[0];
				const ListOfCCs = [];
				data.values.forEach((PL) => {
					if (!ListOfCCs.includes(PL.valueId.commandClassName)) {
						ListOfCCs.push(PL.valueId.commandClassName);
					}
				});
				ListOfCCs.sort();

				const Items = [];

				ListOfCCs.forEach((CC) => {
					const Item = {
						label: CC,
						children: []
					};

					const Properties = data.values.filter((V) => V.valueId.commandClassName === CC);
					Item.label = `0x${Properties[0].valueId.commandClass.toString(16)} - ${Item.label}`;
					Properties.forEach((P) => {
						const Label = P.metadata !== undefined ? P.metadata.label || P.valueId.property : P.valueId.property;
						const Writeable = P.metadata !== undefined ? (P.metadata.writeable ? 'fa fa-pencil' : '') : '';
						const LabelDiv = $('<div>')
							.text(Label)
							.append(
								`<span style="float:right;padding-right:20px">${P.currentValue || ''} ${P.metadata.unit || ''}</span>`
							);
						Item.children.push({
							element: LabelDiv,
							icon: Writeable
						});
					});
					Items.push(Item);
				});

				$('#zwavejz-cc-list-list').treeList('data', Items);
			} else {
				alert(data.response);
			}
		});
	};

	const addNodeMenuItems = (MenuHeader) => {
		const Network = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.css({ cursor: 'pointer' })
			.append('<i class="fa fa-cogs"></i>')
			.click(showNodeManagement);
		MenuHeader.append(Network);

		const Inclusion = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-handshake-o"></i>');
		MenuHeader.append(Inclusion);

		const Repair = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-medkit"></i>');
		MenuHeader.append(Repair);

		const Remove = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-trash-o"></i>');
		MenuHeader.append(Remove);
	};

	const addControllerMenuItems = (MenuHeader) => {
		const Network = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.css({ cursor: 'pointer' })
			.append('<i class="fa fa-cogs"></i>')
			.click(showNetworkManagement);
		MenuHeader.append(Network);

		const Refresh = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-refresh"></i>');
		MenuHeader.append(Refresh);

		const Repair = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-medkit"></i>');
		MenuHeader.append(Repair);
	};

	const init = () => {
		// Container
		const Content = $('<div>').addClass('red-ui-sidebar-info').css({
			position: 'relative',
			height: '100%',
			overflowY: 'hidden',
			display: 'flex',
			flexDirection: 'column'
		});

		// Select Header
		const NetworkSelectHeader = $('<div>')
			.addClass('red-ui-sidebar-header')
			.css({ height: '20px', textAlign: 'center', display: 'none' });
		NetworkSelectHeader.append('<i class="fa fa-cog" aria-hidden="true"></i> Network/Runtime : ');
		const Select = $('<select><option>Select Network</option>')
			.attr('id', 'selectedNetwork')
			.css({ height: '25px', verticalAlign: 'baseline' })
			.on('change', networkSelected);
		NetworkSelectHeader.append(Select);
		Content.append(NetworkSelectHeader);

		// Controller info header
		const ControllerInfoHeader = $('<div>').addClass('red-ui-sidebar-header').addClass('zwavejs-info-header');
		ControllerInfoHeader.append('<i class="fa fa-wifi"></i>');
		Content.append(ControllerInfoHeader);

		// Controller info container
		const ControllerInfoContainer = $('<div>').addClass('zwavejs-info-container');
		ControllerInfoContainer.append('<span id="zwavejs-radio-model">No network selected</span>');
		ControllerInfoContainer.append('<br />');
		ControllerInfoContainer.append('<span id="zwavejs-radio-manufacture">&nbsp;</span>');
		ControllerInfoContainer.append('<span id="zwavejs-radio-version">&nbsp;</span>');
		ControllerInfoContainer.append('<span id="zwavejs-radio-status">&nbsp;</span>');
		ControllerInfoHeader.append(ControllerInfoContainer);

		// Menu Header
		const MenuHeader = $('<div>').addClass('red-ui-sidebar-header').addClass('zwavejs-controller-menu-header');
		Content.append(MenuHeader);
		addControllerMenuItems(MenuHeader);

		// Stack
		const stackContainer = $('<div>')
			.addClass('red-ui-sidebar-info-stack')
			.attr('id', 'zwavejs-panel-stack')
			.css({ height: '100%', width: '100%' })
			.appendTo(Content);

		// Node list
		const NodeListSection = $('<div>');
		NodeListSection.appendTo(stackContainer);

		$('<div>')
			.attr('id', 'zwavejs-node-list')
			.css({ width: '100%', height: '100%' })
			.treeList({ data: [] })
			.appendTo(NodeListSection);

		// Node Info
		const NodeInfoSection = $('<div>');
		NodeInfoSection.appendTo(stackContainer);

		const NodeInfoHeader = $('<div>').addClass('red-ui-sidebar-header').addClass('zwavejs-info-header');
		NodeInfoHeader.append('<i class="fa fa-microchip"></i>');
		NodeInfoHeader.appendTo(NodeInfoSection);

		const NodeInfoContainer = $('<div>').addClass('zwavejs-info-container');
		NodeInfoContainer.append('<span id="zwavejs-node-model">No node selected</span>');
		NodeInfoContainer.append('<br />');
		NodeInfoContainer.append('<span id="zwavejs-node-manufacture">&nbsp;</span>');
		NodeInfoContainer.append('<span id="zwavejs-node-version">&nbsp;</span>');
		NodeInfoContainer.append('<span id="zwavejs-node-status">&nbsp;</span>');
		NodeInfoContainer.appendTo(NodeInfoHeader);

		const NodeMenuHeader = $('<div>').addClass('red-ui-sidebar-header').addClass('zwavejs-controller-menu-header');
		NodeInfoSection.append(NodeMenuHeader);
		addNodeMenuItems(NodeMenuHeader);

		$('<div>')
			.attr('id', 'zwavejz-cc-list-list')
			.css({ width: '100%', height: '100%' })
			.treeList({ data: [] })
			.appendTo(NodeInfoSection);

		const panels = RED.panels.create({ container: stackContainer });
		panels.ratio(0.4);

		const resizeStack = () => panels.resize(Content.height());
		RED.events.on('sidebar:resize', resizeStack);
		$(window).on('resize', resizeStack);
		$(window).on('focus', resizeStack);

		// Add tab
		RED.sidebar.addTab({
			id: 'zwave-js',
			label: ' ZWave JS',
			name: 'Z-Wave JS',
			content: Content,
			enableOnEdit: true,
			iconClass: 'fa fa-wifi',
			onchange: () => setTimeout(resizeStack, 0)
		});

		// Show/Hide/pre-Select
		const processSelectAccess = () => {
			// why 2 - the first is a prompt
			if (Select.children().length === 2) {
				NetworkSelectHeader.css({ display: 'none' });
				$('#selectedNetwork option:eq(1)').attr('selected', 'selected');
				Select.trigger('change');
			}

			if (Select.children().length > 2) {
				NetworkSelectHeader.css({ display: 'block' });
			}
		};

		// Live Adding/removing
		const addNetwork = (Event, data) => {
			Select.append(`<option id="${data.id}" value="${data.id}">${data.name}</option>`);
			processSelectAccess();
		};
		const removeNetwork = (Event, data) => {
			Select.children(`option[id="${data.id}"]`).remove();
			processSelectAccess();
		};
		RED.comms.subscribe('zwave-js/ui/global/addnetwork', addNetwork);
		RED.comms.subscribe('zwave-js/ui/global/removenetwork', removeNetwork);

		// Load current networks
		setTimeout(() => {
			RED.nodes.eachConfig((R) => {
				if (R.type === 'zwavejs-runtime' && !R.d) {
					Select.append(`<option id="${R.id}" value="${R.id}">${R.name}</option>`);
				}
			});
			processSelectAccess();
		}, 250);

		// Node List Selected
		$('#zwavejs-node-list').on('treelistselect', nodeSelected);
	};

	return { init };
})();
