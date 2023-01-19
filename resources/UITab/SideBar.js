/* eslint-disable prefer-const */
/* eslint-env jquery */
/* eslint-env browser */
/* eslint no-undef: "warn"*/
/* eslint no-unused-vars: "warn"*/

// UI Function placholders
let IE;
let Grant;
let ValidateDSK;
let NetworkSelected;
let ShowNetworkManagement;
let ShowNodeManagement;

// Globals
const toTitleCase = (str) => {
	return str.replace(/\w\S*/g, function (txt) {
		return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
	});
};

const prompt = async (Message, Buttons, NoCancel = false) => {
	return new Promise((resolve) => {
		let Prompt = $('<div>');
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
const modalHeight = 620;
const maxModalWidth = 1120;

const ZWaveJSUI = (function () {
	// Vars
	let networkId;
	let selectedNode;
	let stepsAPI;
	let clientSideAuth = false;

	// Runtime event Callbacks
	const commsLog = (event, data) => {
		$('#zwave-js-log').append(data.log);
		if ($('.zwave-js-log').scrollTop() > parseInt($('.zwave-js-log').prop('scrollHeight')) - 1000) {
			$('.zwave-js-log').scrollTop(parseInt($('.zwave-js-log').prop('scrollHeight')));
		}
	};
	const commsStatus = (event, data) => {
		$('#zwavejs-radio-status').text(data.status);
	};
	const commsNodeAdded = (event, data) => {
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
	};
	const commsNodeRemoved = (event, data) => {
		stepsAPI.setStepIndex(StepList.Removed);
	};
	const commsGrant = (event, data) => {
		clientSideAuth = data.clientSideAuth;
		data.securityClasses.forEach((SC) => {
			$('#S2ClassesTable').append(
				`<tr><td>${S2Classes[SC]}</td><td><input type="checkbox" value="${SC}" class="S2Class" /></td></tr>`
			);
		});
		stepsAPI.setStepIndex(StepList.Grant);
	};
	const commsDSK = (event, data) => {
		const Parts = data.dsk.split('-');
		for (let i = 1; i < Parts.length; i++) {
			$(`#DSK_Hint${i}`).val(Parts[i]);
		}
		stepsAPI.setStepIndex(StepList.DSK);
	};

	// Runtime Communication Methods
	const Runtime = {
		Get: async function (API, Method, URL) {
			return new Promise((resolve, reject) => {
				$.ajax({
					type: 'GET',
					url: URL || `zwave-js/ui/${networkId}/${API}/${Method}`,
					success: (data) => resolve(data),
					error: (jqXHR, textStatus, errorThrown) =>
						reject(new Error(`${textStatus}: ${errorThrown}`)) /* Transport error */,
					dataType: 'json'
				});
			});
		},
		Post: async function (API, Method, Data, URL) {
			return new Promise((resolve, reject) => {
				$.ajax({
					type: 'POST',
					data: JSON.stringify(Data),
					url: URL || `zwave-js/ui/${networkId}/${API}/${Method}`,
					success: (data) => resolve(data),
					error: (jqXHR, textStatus, errorThrown) =>
						reject(new Error(`${textStatus}: ${errorThrown}`)) /* Transport error */,
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
				if (!data.callSuccess) {
					alert(data.response);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	ValidateDSK = () => {
		Runtime.Post(undefined, undefined, [$('#DSK').val()], `zwave-js/ui/${networkId}/s2/dsk`)
			.then((data) => {
				if (!data.callSuccess) {
					alert(data.response);
				}
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
				Runtime.Post('CONTROLLER', 'beginExclusion', [Request])
					.then((data) => {
						if (data.callSuccess) {
							stepsAPI.setStepIndex(StepList.NIF);
						} else {
							alert(data.response);
						}
					})
					.catch((Error) => {
						alert(Error.message);
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
					Runtime.Post('CONTROLLER', 'beginInclusion', [Request])
						.then((data) => {
							if (data.callSuccess) {
								stepsAPI.setStepIndex(StepList.NIF);
							} else {
								alert(data.response);
							}
						})
						.catch((Error) => {
							alert(Error.message);
						});
				}
			});
		}

		if (Mode === 'S2') {
			Request = {
				strategy: 4
			};
			Runtime.Post('CONTROLLER', 'beginInclusion', [Request])
				.then((data) => {
					if (data.callSuccess) {
						stepsAPI.setStepIndex(StepList.NIF);
					} else {
						alert(data.response);
					}
				})
				.catch((Error) => {
					alert(Error.message);
				});
		}

		if (Mode === 'S0') {
			Request = {
				strategy: 3
			};
			Runtime.Post('CONTROLLER', 'beginInclusion', [Request])
				.then((data) => {
					if (data.callSuccess) {
						stepsAPI.setStepIndex(StepList.NIF);
					} else {
						alert(data.response);
					}
				})
				.catch((Error) => {
					alert(Error.message);
				});
		}

		if (Mode === 'NS') {
			Request = {
				strategy: 2
			};
			Runtime.Post('CONTROLLER', 'beginInclusion', [Request])
				.then((data) => {
					if (data.callSuccess) {
						stepsAPI.setStepIndex(StepList.NIF);
					} else {
						alert(data.response);
					}
				})
				.catch((Error) => {
					alert(Error.message);
				});
		}
	};

	// Show Network Options
	ShowNetworkManagement = () => {
		const HTML = $('#TPL_NetworkManagement').html();
		const Panel = $('<div>');
		Panel.append(HTML);

		const Settings = {
			title: 'Network Management',
			modal: true,
			width: modalWidth,
			height: modalHeight,
			maxWidth: maxModalWidth,
			resizable: true,
			draggable: true,
			close: function () {
				Runtime.Post(undefined, undefined, { stream: false }, `zwave-js/ui/${networkId}/log`)
					.then((data) => {
						RED.comms.unsubscribe(`zwave-js/ui/${networkId}/log`, commsLog);
						$('#zwave-js-log').empty();
					})
					.catch((Error) => {
						//
					});
				Panel.remove();
			}
		};

		Panel.dialog(Settings);
		$('#TPL_NetworkManagementTabs').tabs().addClass('zwave-js-vertical-tabs ui-helper-clearfix');
		$('#TPL_NetworkManagementTabs li').removeClass('ui-corner-top').addClass('ui-corner-left');

		// Basic Controller Info
		Runtime.Get('CONTROLLER', 'getNodes')
			.then((data) => {
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
			})
			.catch((Error) => {
				alert(Error.message);
			});

		// Power Level
		Runtime.Get('CONTROLLER', 'getPowerlevel')
			.then((data) => {
				if (data.callSuccess) {
					$('#CSettings_PL').val(data.response.powerlevel);
					$('#CSettings_0DBM').val(data.response.measured0dBm);
				} else {
					alert(data.response);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});

		// Region
		Runtime.Get('CONTROLLER', 'getRFRegion')
			.then((data) => {
				if (data.callSuccess) {
					//
				} else {
					$('#CSettings_Regions').prop('disabled', 'disabled');
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});

		const Steps = $('#IEWizard').steps({ showFooterButtons: false });
		stepsAPI = Steps.data('plugin_Steps');

		/* Logs */
		Runtime.Post(undefined, undefined, { stream: true }, `zwave-js/ui/${networkId}/log`)
			.then((data) => {
				if (data.callSuccess) {
					if (data.response) {
						RED.comms.subscribe(`zwave-js/ui/${networkId}/log`, commsLog);
					} else {
						$('#TPL_NetworkManagementTabs').tabs({ disabled: [5] });
					}
				} else {
					alert(data.response);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	// Show Node  Options
	ShowNodeManagement = () => {
		if (selectedNode) {
			const HTML = $('#TPL_NodeManagement').html();
			const Panel = $('<div>');
			Panel.append(HTML);

			const Settings = {
				title: 'Node Management',
				modal: true,
				width: modalWidth,
				height: modalHeight,
				maxWidth: maxModalWidth,
				resizable: true,
				draggable: true,
				close: function () {
					Panel.remove();
				}
			};

			Panel.dialog(Settings);
			$('#TPL_NodeManagementTabs').tabs().addClass('zwave-js-vertical-tabs ui-helper-clearfix');
			$('#TPL_NodeManagementTabs li').removeClass('ui-corner-top').addClass('ui-corner-left');

			// Basic Node Info
			Runtime.Get('CONTROLLER', 'getNodes')
				.then((data) => {
					if (data.callSuccess) {
						const Node = data.response.Event.eventBody.find((N) => N.nodeId === selectedNode);

						const NITable = $('#NITable');
						NITable.append(`<tr><td>Device</td><td>${Node.deviceConfig.description}</td>`);
						NITable.append(`<tr><td>Manufacturer</td><td>${Node.deviceConfig.manufacturer}</td>`);
						NITable.append(`<tr><td>Firmware Version</td><td>${Node.firmwareVersion}</td>`);

						const NSTable = $('#NSTable');
						NSTable.append(`<tr><td>Interview Stage</td><td>${Node.interviewStage}</td>`);
						NSTable.append(`<tr><td>Power Source</td><td>${toTitleCase(Node.powerSource.type)}</td>`);
						if (Node.powerSource.type === 'battery') {
							NSTable.append(`<tr><td>Battery Level</td><td>${Node.powerSource.level}</td>`);
							NSTable.append(`<tr><td>Is Low</td><td>${Node.powerSource.isLow}</td>`);
						}
						NSTable.append(`<tr><td>Status</td><td>${Node.status}</td>`);
						NSTable.append(`<tr><td>Ready</td><td>${Node.ready}</td>`);
						NSTable.append(`<tr><td>Security Mode</td><td>${S2Classes[Node.highestSecurityClass]}</td>`);

						const NSTTable = $('#NSTTable');
						delete Node.statistics.lwr;
						for (const [key, value] of Object.entries(Node.statistics)) {
							NSTTable.append(`<tr><td>${key}</td><td>${value}</td>`);
						}
					} else {
						alert(data.response);
					}
				})
				.catch((Error) => {
					alert(Error.message);
				});
		}
	};

	// Network Selecetd
	NetworkSelected = function () {
		// Remove Subscriptions
		if (networkId) {
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/status`, commsStatus);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/s2/grant`, commsGrant);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/s2/dsk`, commsDSK);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/added`, commsNodeAdded);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/removed`, commsNodeRemoved);
			networkId = undefined;
		}

		networkId = $('#zwave-js-network').val();

		// get Nodes ansd Info
		Runtime.Get('CONTROLLER', 'getNodes')
			.then((data) => {
				if (data.callSuccess) {
					data = data.response.Event.eventBody;

					const Controller = data.filter((N) => N.isControllerNode)[0];

					const Info = `${Controller.deviceConfig.manufacturer} | ${Controller.deviceConfig.label} | v${Controller.firmwareVersion}`;
					$('#zwave-js-controller-info').text(Info);

					const Nodes = data.filter((N) => !N.isControllerNode);

					// Render List
					const TreeData = [];
					Nodes.forEach((N) => {
						const Label = $('<div>');
						Label.append(`<span class="zwave-js-node-id-list">${N.nodeId}</span> `);
						Label.append(N.nodeName || 'No Name');

						TreeData.push({
							element: Label,
							nodeData: N
							//icon: 'fa fa-circle'
						});
					});
					$('#zwavejs-node-list').treeList('data', TreeData);
				} else {
					alert(data.response);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});

		Runtime.Get(undefined, undefined, `zwave-js/ui/${networkId}/status`)
			.then((data) => {
				if (data.callSuccess) {
					$('#zwave-js-controller-status').text(data.response);
				} else {
					alert(data.response);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});

		// subscribe

		RED.comms.subscribe(`zwave-js/ui/${networkId}/status`, commsStatus);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/added`, commsNodeAdded);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/removed`, commsNodeRemoved);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/s2/grant`, commsGrant);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/s2/dsk`, commsDSK);
	};

	// Value Editor
	const edit = (VID) => {
		const HTML = $('#TPL_ValueEditor').html();
		const Panel = $('<div>');
		Panel.append(HTML);

		const Settings = {
			title: 'Edit Value',
			modal: false,
			width: 300,
			height: 350,
			resizable: false,
			draggable: true,
			close: function () {
				Panel.remove();
			}
		};

		Panel.dialog(Settings);

		const Label = VID.metadata ? VID.metadata.label || VID.valueId.property : VID.valueId.property;
		let CurrentValue = VID.currentValue;
		const Unit = VID.metadata ? VID.metadata.unit || '' : '';

		if (VID.metadata && VID.metadata.states && VID.currentValue !== undefined) {
			CurrentValue = VID.metadata.states[VID.currentValue];
		}

		$('#zwave-js-value-command-class').text(VID.valueId.commandClassName);
		$('#zwave-js-value-name').text(Label);
		if (VID.metadata) {
			$('#zwave-js-value-description').text(VID.metadata.description);
		}

		$('#zwave-js-value-current').text(`${CurrentValue} ${Unit}`);


		
		const Select = $('<select>');

		for (const [key, value] of Object.entries(VID.metadata.states)) {
			Select.append(new Option(value, key));
		}

		$('#zwave-js-value-new').append(Select);
	};

	// Node Selected
	const nodeSelected = (event, item) => {
		if (!item.nodeData) return;

		selectedNode = item.nodeData.nodeId;

		const Info = `${item.nodeData.deviceConfig.manufacturer} | ${item.nodeData.deviceConfig.label} | v${item.nodeData.firmwareVersion}`;
		$('#zwave-js-node-info').text(Info);
		$('#zwave-js-node-status').text(item.nodeData.status);
		$('#zwave-js-node-info-id').text(selectedNode);

		Runtime.Post('CONTROLLER', 'getValueDB', [item.nodeData.nodeId])
			.then((data) => {
				if (data.callSuccess) {
					data = data.response.Event.eventBody[0];
					const ListOfCCs = [];
					data.values.forEach((PL) => {
						if (ListOfCCs.filter((CC) => CC.commandClass === PL.valueId.commandClass).length < 1) {
							ListOfCCs.push({ commandClassName: PL.valueId.commandClassName, commandClass: PL.valueId.commandClass });
						}
					});
					ListOfCCs.sort((a, b) => a.commandClassName > b.commandClassName);

					const Items = [];

					ListOfCCs.forEach((CC) => {
						const Item = {
							label: `0x${CC.commandClass.toString(16).toUpperCase()} - ${CC.commandClassName}`,
							children: []
						};

						const Properties = data.values.filter((V) => V.valueId.commandClass === CC.commandClass);

						Properties.forEach((P) => {
							let Label = P.metadata ? P.metadata.label || P.valueId.property : P.valueId.property;
							let CurrentValue = P.currentValue;
							const Unit = P.metadata ? P.metadata.unit || '' : '';
							const Writeable = P.metadata ? P.metadata.writeable || false : false;

							if (P.metadata && P.metadata.states && P.currentValue !== undefined) {
								CurrentValue = P.metadata.states[P.currentValue];
							}

							const LabelDiv = $('<div>')
								.text(Label)
								.append(`<span style="float:right;padding-right:20px">${CurrentValue} ${Unit}</span>`);

							if (Writeable) {
								const Edit = $('<i>')
									.addClass('fa')
									.addClass('fa-pencil')
									.attr('aria-hidden', 'true')
									.css({ marginRight: '5px' })
									.click(() => edit(P));

								LabelDiv.prepend(Edit);
							}

							Item.children.push({
								element: LabelDiv
							});
						});
						Items.push(Item);
					});

					$('#zwavejz-cc-list-list').treeList('data', Items);
				} else {
					alert(data.response);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	// Init
	const init = () => {
		// Container
		const Content = $('<div>').addClass('red-ui-sidebar-info').css({
			position: 'relative',
			height: '100%',
			overflowY: 'hidden',
			display: 'flex',
			flexDirection: 'column'
		});

		Content.append($('#TPL_SidePanel').html());

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

		$('#zwavejs-node-list').treeList({ data: [] });
		$('#zwavejz-cc-list-list').treeList({ data: [] });

		const panels = RED.panels.create({ container: $('#zwavejs-panel-stack') });
		panels.ratio(0.4);

		const resizeStack = () => panels.resize(Content.height());
		RED.events.on('sidebar:resize', resizeStack);
		$(window).on('resize', resizeStack);
		$(window).on('focus', resizeStack);

		// Show/Hide/pre-Select
		const processSelectAccess = () => {
			const Select = $('#zwave-js-network');
			const SelectHeader = $('#zwave-js-network-header');

			// why 2 - the first is a prompt
			if (Select.children().length === 2) {
				SelectHeader.css({ display: 'none' });
				$('#zwave-js-network option:eq(1)').attr('selected', 'selected');
				Select.trigger('change');
			}

			if (Select.children().length > 2) {
				SelectHeader.css({ display: 'block' });
			}
		};

		// Live Adding/removing
		const addNetwork = (Event, data) => {
			const Select = $('#zwave-js-network');
			Select.append(`<option id="${data.id}" value="${data.id}">${data.name}</option>`);
			processSelectAccess();
		};
		const removeNetwork = (Event, data) => {
			const Select = $('#zwave-js-network');
			Select.children(`option[id="${data.id}"]`).remove();
			processSelectAccess();
		};
		RED.comms.subscribe('zwave-js/ui/global/addnetwork', addNetwork);
		RED.comms.subscribe('zwave-js/ui/global/removenetwork', removeNetwork);

		// Load current networks
		setTimeout(() => {
			const Select = $('#zwave-js-network');
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
