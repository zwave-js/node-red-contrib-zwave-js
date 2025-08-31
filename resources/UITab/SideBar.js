/* eslint no-undef: "warn"*/

// eslint-disable-next-line no-unused-vars
const ZWaveJS = (function () {
	/*
	 * Just Stuff
	 * Yeah... just stuff - pretty darn important as well!!
	 */
	const AdvancedPanels = [];
	const SetValueOptionExamples = {
		transitionDuration: '30s, 1m, 1m10s',
		volume: 45
	};
	let networkId = undefined;
	let selectedNode = undefined;
	let QRS;
	let TPL_SidePanel = undefined;
	let TPL_ControllerManagement = undefined;
	let TPL_NodeManagement = undefined;
	let TPL_ValueManagement = undefined;
	let AssociationGroups;
	let clientSideAuth = false;
	let nodesExpanded = true;
	let SelectedNodeVIDs = {};

	/*
	 * Driver Communciation Methods
	 * These methods are used to send messages to the API's of the module itself
	 * Runtime.Get, Runtime.Post - sends messages to the runtime of the Driver/Module
	 */

	const Runtime = {
		Get: async function (API, Method, URL) {
			return new Promise((resolve, reject) => {
				$.ajax({
					type: 'GET',
					timeout: 0,
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
					timeout: 0,
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

	/*
	 * Public UI Methods
	 * These methods are seen by the editor (UA) - and need to be.
	 */

	// Init UI
	const init = () => {
		$.get('resources/node-red-contrib-zwave-js/UITab/ValueEditors.html', function (html) {
			Handlebars.registerPartial('ValueEditors', html);
		});

		Handlebars.registerHelper('json', function (object) {
			return JSON.stringify(object, undefined, 2);
		});

		Handlebars.registerHelper('encode', function (object) {
			const json = JSON.stringify(object);
			const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
			return encoded;
		});

		Handlebars.registerHelper('eq', function (actual, expected, options) {
			if (actual === expected) {
				return options.fn(this);
			}
			return options.inverse(this);
		});

		Handlebars.registerHelper('select', function (context, options) {
			const $el = $('<select />').html(options.fn(this));
			$el.find(`[value="${context}"]`).attr({ selected: 'selected' });
			return $el.html();
		});

		Handlebars.registerHelper('pretty', function (context) {
			return JSONFormatter.json.prettyPrint(context);
		});

		// Templates
		TPL_SidePanel = Handlebars.compile($('#ZWJS_TPL_SidePanel').html());
		TPL_ControllerManagement = Handlebars.compile($('#ZWJS_TPL_Tray-Controller').html());
		TPL_NodeManagement = Handlebars.compile($('#ZWJS_TPL_Tray-Node').html());
		TPL_ValueManagement = Handlebars.compile($('#ZWJS_TPL_Tray-Node-Value').html());

		// Container
		const Content = $('<div>').addClass('red-ui-sidebar-info').css({
			position: 'relative',
			height: '100%',
			overflowY: 'hidden',
			display: 'flex',
			flexDirection: 'column'
		});

		Content.append(TPL_SidePanel({}));

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

		$('#zwjs-node-list').treeList({ data: [] });
		$('#zwjs-node-list').on('treelistselect', nodeSelected);
		$('#zwjs-cc-list').treeList({ data: [] });

		const panels = RED.panels.create({ container: $('#zwjs-panel-stack') });
		panels.ratio(0.3);

		const resizeStack = () => panels.resize(Content.height());
		RED.events.on('sidebar:resize', resizeStack);
		$(window).on('resize', resizeStack);
		$(window).on('focus', resizeStack);

		commsListOrAddNetworks(true);

		RED.comms.subscribe('zwave-js/ui/global/addnetwork', (topic, network) => commsListOrAddNetworks(false, network));
		RED.comms.subscribe('zwave-js/ui/global/removenetwork', (topic, network) => commsRemoveNetwork(network));
	};

	// Rebuid Routes
	const RebuildRoutes = (button) => {
		DisableButton(button);
		const Battery = $('#zwjs-routes-battery').prop('checked');
		Runtime.Post('CONTROLLER', 'beginRebuildingRoutes', [{ includeSleeping: Battery }]).then((data) => {
			if (data.callSuccess) {
				EnableButton(button);
			} else {
				alert(data.response);
				EnableButton(button);
			}
		});
	};

	// Update Value
	const UpdateValue = (Button, VID, Defined) => {
		DisableButton(Button);
		VID = DecodeObject(VID);

		let Value;

		if (Defined) {
			Value = parseInt($('#zwjs-cc-value-new-defined').val());
			$('#zwjs-cc-value-new').val(Value);
		} else {
			const el = $('#zwjs-cc-value-new');
			if (el.is('input')) {
				switch (el.attr('type')) {
					case 'number':
						Value = parseInt(el.val());
						break;

					case 'checkbox':
						Value = el.prop('checked');
						break;

					case 'color':
						Value = el.val().substring(1);
						break;
				}
			}
			if (el.is('select')) {
				Value = parseInt(el.val());
			}
		}

		Runtime.Post('VALUE', 'setValue', { nodeId: selectedNode.nodeId, valueId: VID, value: Value }).then((data) => {
			if (data.callSuccess) {
				switch (data.response.status) {
					case 0:
						alert('The Node does not support the command');
						break;
					case 1:
						alert('The Node is working on the requested change');
						break;
					case 2:
						alert('The Node rejected the change');
						break;
					case 3:
						alert('The target Endpoint was not found on the Node');
						break;
					case 4:
						alert('The set command has not been implemented for this CC');
						break;
					case 5:
						alert('The provided value was not valid');
						break;

					default:
						alert('The update was successfull');
						break;
				}

				EnableButton(Button);
			} else {
				alert(data.response);
				EnableButton(Button);
			}
		});
	};

	// Collapse LIst
	const NodeCollapseToggle = () => {
		switch (nodesExpanded) {
			case true:
				$('#zwjs-node-list')
					.treeList('data')
					.forEach((LI) => {
						LI.treeList.collapse();
					});
				nodesExpanded = false;
				break;

			case false:
				$('#zwjs-node-list')
					.treeList('data')
					.forEach((LI) => {
						LI.treeList.expand();
					});
				nodesExpanded = true;
				break;
		}
	};

	// Remove Failed
	const RemoveFailedNode = (NodeID, Row) => {
		if (confirm('Are you sure you wish to remove this Node from your network?')) {
			Runtime.Post('CONTROLLER', 'removeFailedNode', [NodeID]).then((data) => {
				if (data.callSuccess) {
					$(Row).closest('tr').remove();
				} else {
					alert(data.response);
				}
			});
		}
	};

	// Ping Node
	const PingNode = (NodeID) => {
		Runtime.Post('NODE', 'ping', { nodeId: NodeID }).then((data) => {
			if (data.callSuccess) {
				alert('Power Level Set Succcessfully');
			} else {
				alert(data.response);
			}
		});
	};

	// Set Class PowerLevel
	const SetClassicPowerLevel = (Button) => {
		DisableButton(Button);
		const PL = parseInt($('#zwjs-controller-setting-power-classic').val());
		const Calibration = 0;
		Runtime.Post('CONTROLLER', 'setPowerlevel', [PL, Calibration])
			.then((data) => {
				if (data.callSuccess) {
					alert('Power Level Set Succcessfully');
					EnableButton(Button);
				} else {
					alert(data.response);
					EnableButton(Button);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	// Set LR PowerLevel
	const SetLWPowerLevel = (Button) => {
		DisableButton(Button);
		const PL = parseInt($('#zwjs-controller-setting-power-lr').val());
		Runtime.Post('CONTROLLER', 'setMaxLongRangePowerlevel', [PL])
			.then((data) => {
				if (data.callSuccess) {
					alert('Power Level Set Succcessfully');
					EnableButton(Button);
				} else {
					alert(data.response);
					EnableButton(Button);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	// Set Region
	const SetRegion = (Button) => {
		DisableButton(Button);
		const R = parseInt($('#zwjs-controller-setting-region option:selected').val());
		Runtime.Post('CONTROLLER', 'setRFRegion', [R])
			.then((data) => {
				if (data.callSuccess) {
					alert('Region Set Succcessfully');
					EnableButton(Button);
				} else {
					alert(data.response);
					EnableButton(Button);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	// Network Selecetd
	const NetworkSelected = function () {
		if (networkId) {
			// unsubscribe
			setSubscription(false);
		}

		if ($('#zwjs-network').val() === 'NONE') {
			ClearSelection(true);
			return;
		}

		networkId = $('#zwjs-network').val();

		// get Nodes ansd Info
		RefreshNodes('NetworkSelected');

		Runtime.Get(undefined, undefined, `zwave-js/ui/${networkId}/status`)
			.then((data) => {
				if (data.callSuccess) {
					$('#zwjs-controller-status').text(data.response);
				} else {
					alert(data.response);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});

		// subscribe
		setSubscription(true);
	};

	// Show Network Options
	const ShowNetworkManagement = () => {
		if (!networkId) {
			return;
		}

		CloseTray();

		Runtime.Get('CONTROLLER', 'getNodes')
			.then((data) => {
				if (data.callSuccess) {
					const RCD = data.response.find((N) => N.isControllerNode);
					if (RCD.statistics.backgroundRSSI) {
						RCD.backgroundRSSI = FlattenChannelAverages(RCD.statistics.backgroundRSSI);
					} else {
						RCD.backgroundRSSI = {};
					}

					delete RCD.statistics.backgroundRSSI;

					$('#zwjs-controller-info').data('info', RCD);

					const Options = {
						width: 900,
						title: 'ZWave JS Controller Management',
						buttons: [
							{
								id: 'zwjs-tray-about',
								text: 'About Zwave JS',
								click: function () {
									CloseTray();
								}
							},
							{
								id: 'zwjs-tray-close',
								text: 'Close',
								click: function () {
									CloseTray();
								}
							}
						],
						open: function (tray) {
							const trayBody = tray.find('.red-ui-tray-body, .editor-tray-body');
							const State = {
								Network: $('#zwjs-controller-info').text(),
								Status: $('#zwjs-controller-status').text()
							};
							trayBody.append(TPL_ControllerManagement(State));
						}
					};
					RED.tray.show(Options);
					setTimeout(() => {
						$('.zwjs-tray-menu > div[default]').trigger('click');
					}, 250);
				} else {
					alert(Error.message);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	// Show Node Options
	const ShowNodeManagement = () => {
		if (!selectedNode) {
			return;
		}

		CloseTray();

		Runtime.Get('CONTROLLER', 'getNodes')
			.then((data) => {
				if (data.callSuccess) {
					const RND = data.response.find((N) => N.nodeId === selectedNode.nodeId);
					delete RND.statistics.lwr;
					GetNodeGroup(selectedNode.nodeLocation).children.find((N) => N.nodeData.nodeId === RND.nodeId).nodeData = RND;

					const Options = {
						width: 900,
						title: 'ZWave JS Node Management',
						buttons: [
							{
								id: 'zwjs-tray-about',
								text: 'About Zwave JS',
								click: function () {
									CloseTray();
								}
							},
							{
								id: 'zwjs-tray-close',
								text: 'Close',
								click: function () {
									CloseTray();
								}
							}
						],
						open: function (tray) {
							const trayBody = tray.find('.red-ui-tray-body, .editor-tray-body');
							const State = {
								NodeID: $('#zwjs-node-info-id').text(),
								Status: $('#zwjs-node-status').text(),
								NodeInfo: $('#zwjs-node-info').text()
							};
							trayBody.append(TPL_NodeManagement(State));
						}
					};
					RED.tray.show(Options);
					setTimeout(() => {
						$('.zwjs-tray-menu > div[default]').trigger('click');
					}, 250);
				} else {
					alert(Error.message);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	// Interview Current Node
	const InterviewCurrentNode = () => {
		if (!selectedNode) {
			return;
		}
		if (confirm('Are you sure you wish to re-interview this Node?')) {
			Runtime.Post('NODE', 'refreshInfo', { nodeId: selectedNode.nodeId })
				.then((data) => {
					if (!data.callSuccess) {
						alert(data.response);
					}
				})
				.catch((Error) => {
					alert(Error.message);
				});
		}
	};

	// Render Advanced Panel Content
	const RenderAdvanced = async (TemplateID, Target, FunctionIDORObject) => {
		if (!AdvancedPanels.find((P) => P.id === TemplateID)) {
			const TPL = Handlebars.compile($(`#${TemplateID}`).html());
			AdvancedPanels.push({ id: TemplateID, compiled: TPL });
		}

		let Data = {};
		if (FunctionIDORObject && RenderFunctions[FunctionIDORObject]) {
			try {
				Data = await RenderFunctions[FunctionIDORObject]();
			} catch (Response) {
				alert(Response);
				return;
			}
		} else if (FunctionIDORObject && typeof FunctionIDORObject === 'object') {
			Data = FunctionIDORObject;
		} else if (FunctionIDORObject && typeof FunctionIDORObject === 'string') {
			Data = DecodeObject(FunctionIDORObject);
		}

		const Output = AdvancedPanels.find((P) => P.id === TemplateID).compiled(Data);
		$('#zwjs-advanced-content').empty();
		$('#zwjs-advanced-content').append(Output);

		if (Target) {
			$('.zwjs-tray-menu div').removeAttr('active');
			$(Target).attr('active', '');
		}
	};

	// Exclusion
	const StartExclusion = () => {
		Runtime.Get('CONTROLLER', 'beginExclusion').then((R) => {
			if (R.callSuccess) {
				RenderAdvanced('ZWJS_TPL_NIFWait', undefined, { mode: 'Exclusion' });
			} else {
				alert(R.response);
			}
		});
	};

	// Inclusion
	const StartInclusion = () => {
		const IS = $('input[type="radio"][name="ZWJS_IS"]:checked').val();

		if (IS !== 'SS') {
			const ISO = {
				strategy: parseInt(IS),
				forceSecurity: false
			};
			Runtime.Post('CONTROLLER', 'beginInclusion', [ISO]).then((R) => {
				if (R.callSuccess) {
					RenderAdvanced('ZWJS_TPL_NIFWait', undefined, { mode: 'Inclusion' });
				} else {
					alert(R.response);
				}
			});
		} else {
			RenderAdvanced('ZWJS_TPL_QRRead', undefined, 'StartCamera');
		}
	};

	// Grant Secuity Classes
	const GrantClasses = (Button) => {
		const Granted = {
			clientSideAuth: clientSideAuth,
			securityClasses: []
		};

		$('input[type="checkbox"][name="ZWJS_SCLASS"]:checked').each((i, e) => {
			Granted.securityClasses.push(parseInt($(e).val()));
		});

		Runtime.Post(undefined, undefined, [Granted], `zwave-js/ui/${networkId}/s2/grant`).then((R) => {
			if (R.callSuccess) {
				DisableButton(Button);
			} else {
				alert(R.response);
			}
		});
	};

	// Submit DSK
	const SubmitDSK = (Button) => {
		Runtime.Post(undefined, undefined, [$('#zwjs-dsk').val()], `zwave-js/ui/${networkId}/s2/dsk`).then((R) => {
			if (R.callSuccess) {
				DisableButton(Button);
			} else {
				alert(R.response);
			}
		});
	};

	// Submit Provisioning Entry
	const SubmitProvisioningEntry = (Button) => {
		DisableButton(Button);

		const Entry = JSON.parse(atob($('#zwjs-qrdata').attr('data-entry')));
		Entry.securityClasses = [];
		Entry.status = 0;

		$('input[type="checkbox"][name="ZWJS_SCLASS"]:checked').each((i, e) => {
			Entry.securityClasses.push(parseInt($(e).val()));
		});

		Runtime.Post('CONTROLLER', 'provisionSmartStartNode', [Entry]).then((R) => {
			if (R.callSuccess) {
				RenderAdvanced('ZWJS_TPL_SSDone');
			} else {
				alert(R.response);
			}
		});
	};

	// Set Provisioning Entry Status
	const SetPEActive = (El, Entry) => {
		Entry = DecodeObject(Entry);
		delete Entry.checked;
		delete Entry.shortDSK;
		Entry.status = $(El).prop('checked') ? 0 : 1;

		Runtime.Post('CONTROLLER', 'provisionSmartStartNode', [Entry]).then((R) => {
			if (!R.callSuccess) {
				alert(R.response);
			}
		});
	};

	// Delete Provisioning Entry
	const DeletePE = (El, Entry) => {
		if (confirm('Are you sure you wish to delete this Provisioning Entry? Note: it will not exclude the device.')) {
			Entry = DecodeObject(Entry);
			delete Entry.checked;
			delete Entry.shortDSK;
			Runtime.Post('CONTROLLER', 'unprovisionSmartStartNode', [Entry.dsk]).then((R) => {
				if (R.callSuccess) {
					$(El).parent().parent().remove();
				} else {
					alert(R.response);
				}
			});
		}
	};

	// Set Name & Location
	const SetNameLocation = (Button) => {
		DisableButton(Button);
		Runtime.Post('NODE', 'setName', {
			nodeId: selectedNode.nodeId,
			value: $('#zwjs-node-edit-name').val() || undefined
		})
			.then((data) => {
				if (!data.callSuccess) {
					alert(data.response);
					EnableButton(Button);
				} else {
					Runtime.Post('NODE', 'setLocation', {
						nodeId: selectedNode.nodeId,
						value: $('#zwjs-node-edit-location').val() || undefined
					})
						.then((data) => {
							if (!data.callSuccess) {
								alert(data.response);
								EnableButton(Button);
							} else {
								RefreshNodes('Named');

								alert('Name & Location Set Successfully!');
								EnableButton(Button);
							}
						})
						.catch((Error) => {
							EnableButton(Button);
							alert(Error.message);
						});
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	// Asso EP Select Callback
	const processAssociationEPSelect = () => {
		const EP = $('#zwjs-asso-endpoints').val();
		const GPs = AssociationGroups[EP];

		$('#zwjs-asso-groups').empty();
		$('#zwjs-asso-groups').append(new Option('Select Association Group'));

		for (const [ID, GP] of Object.entries(GPs)) {
			$('#zwjs-asso-groups').append(new Option(`${GP.label} (Max: ${GP.maxNodes})`, ID));
		}
	};

	// Asso GP Select Callback
	const processAssociationGPSelect = () => {
		const Group = parseInt($('#zwjs-asso-groups').val());
		const Address = {
			nodeId: selectedNode.nodeId,
			endpoint: parseInt($('#zwjs-asso-endpoints').val())
		};
		Runtime.Post('CONTROLLER', 'getAssociations', [Address]).then((data) => {
			const Mapped = data.response[Group];

			$('#zwjs-asso-mappings').empty();
			$('#zwjs-asso-mappings').append(
				'<tr><td style="text-align:center">Target Node</td><td style="text-align:center">Target Endpoint</td><td style="text-align:center">Delete</td></tr>'
			);
			Mapped.forEach((v) => {
				$('#zwjs-asso-mappings').append(
					`<tr><td style="text-align:center">${v.nodeId}</td><td style="text-align:center">${v.endpoint === undefined ? '&lt;Node-Associtation&gt;' : v.endpoint}</td><td style="text-align:center"><i class="fa fa-trash" aria-hidden="true" style="font-size: 18px;color: red; cursor:pointer" onclick="ZWaveJS.MarkAssoDelete(this)"></i></td></tr>`
				);
			});
		});
	};

	// Add new Asso element
	const PreppNewAssociation = () => {
		$('#zwjs-asso-mappings').append(
			'<tr data-role="zwjs-new-association"><td style="text-align:center"><input type="number" data-role="zwjs-node" value="1" min="1"></td><td style="text-align:center"><input type="number" data-role="zwjs-endpoint" min="0" placeholder="<Empty: Node-Association>"></td><td>&nbsp;</td></tr>'
		);
	};

	// Send Associations
	const CommitAssociations = (Button) => {
		DisableButton(Button);
		const Addresses = [];
		$("[data-role='zwjs-remove-association']").each(function () {
			const Node = parseInt($(this).find('td').first().text());
			let Endpoint = parseInt($(this).find('td').first().next().text());
			if (isNaN(Endpoint)) {
				Endpoint = undefined;
			}
			Addresses.push({ nodeId: Node, endpoint: Endpoint });
		});

		if (Addresses.length > 0) {
			const Params = [
				{ nodeId: selectedNode.nodeId, endpoint: parseInt($('#zwjs-asso-endpoints').val()) },
				parseInt($('#zwjs-asso-groups').val()),
				Addresses
			];
			Runtime.Post('CONTROLLER', 'removeAssociations', Params)
				.then((response) => {
					if (response.callSuccess) {
						CommitAssociationsAdd(Button);
					} else {
						EnableButton(Button);
						alert(response.response);
					}
				})
				.catch((Error) => {
					alert(Error.message);
					EnableButton(Button);
				});
		} else {
			CommitAssociationsAdd(Button);
		}
	};

	// Clear All Associations
	const ResetAllAssociations = (Button) => {
		if (
			confirm(
				'Are you sure you wish to wipe all Associations? this includes the LifeLine associations, you will need to re-create them after.'
			)
		) {
			DisableButton(Button);
			Runtime.Post('CONTROLLER', 'getAllAssociations', [selectedNode.nodeId])
				.then((response) => {
					if (response.callSuccess) {
						response.response.forEach(function (E) {
							Object.keys(E.associations).forEach(async function (G) {
								if (E.associations[G].length > 0) {
									const Params = [];
									Params.push(E.associationAddress);
									Params.push(parseInt(G));
									Params.push(E.associations[G]);
									try {
										await Runtime.Post('CONTROLLER', 'removeAssociations', Params);
									} catch (Error) {
										alert(Error.message);
										EnableButton(Button);
									}
								}
							});
						});
						alert('All associations successfully removed!');
						EnableButton(Button);
						processAssociationGPSelect();
					} else {
						alert(response.response);
						EnableButton(Button);
					}
				})
				.catch((Error) => {
					EnableButton(Button);
					alert(Error.message);
				});
		}
	};

	// Mark Asso for removal
	const MarkAssoDelete = (El) => {
		$(El).closest('tr').attr('data-role', 'zwjs-remove-association');
		$(El).closest('tr').css({ textDecoration: 'line-through', color: 'silver' });
	};

	// Check Node Helath
	const CheckNodeHealth = (Button) => {
		DisableButton(Button);
		$('#zwjs-node-health-check').find('tr:gt(0)').remove();
		const AddTesting = () => {
			$('#zwjs-node-health-check').append(
				'<tr><td style="text-align:center"><div class="zwjs-rating" wait>Testing...</div></td><td style="text-align:center">---</td><td style="text-align:center">---</td><td style="text-align:center">---</td><td style="text-align:center">---</td><td style="text-align:center">---</td><td style="text-align:center">---</td><td style="text-align:center">---</td></tr>'
			);
		};

		const RemoveTesting = () => {
			$('#zwjs-node-health-check tr:last').remove();
		};

		const FeedBack = (topic, data) => {
			RemoveTesting();
			const Rating = () => {
				if (data.check.lastResult.rating > 5) {
					return `<div class="zwjs-rating" good>${data.check.lastResult.rating}/10</div>`;
				}
				if (data.check.lastResult.rating > 3) {
					return `<div class="zwjs-rating" warn>${data.check.lastResult.rating}/10</div>`;
				}
				return `<div class="zwjs-rating" bad>${data.check.lastResult.rating}/10</div>`;
			};

			$('#zwjs-node-health-check').append(
				`<tr><td style="text-align:center">${Rating()}</td><td style="text-align:center">${data.check.lastResult.failedPingsNode}</td><td style="text-align:center">${data.check.lastResult.failedPingsController ?? 0}</td><td style="text-align:center">${data.check.lastResult.routeChanges}</td><td style="text-align:center">${data.check.lastResult.latency} ms</td><td style="text-align:center">${data.check.lastResult.numNeighbors}</td><td style="text-align:center">${data.check.lastResult.minPowerlevel} dBm</td><td style="text-align:center">${data.check.lastResult.snrMargin} dBm</td></tr>`
			);
			AddTesting();
		};

		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/healthcheck`, FeedBack);
		AddTesting();
		Runtime.Post('NODE', 'checkLifelineHealth', { nodeId: selectedNode.nodeId })
			.then((data) => {
				if (data.callSuccess) {
					setTimeout(() => {
						EnableButton(Button);
						RemoveTesting();
						RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/healthcheck`, FeedBack);
					}, 250);
				} else {
					alert(data.response);
				}
			})
			.catch((Error) => {
				EnableButton(Button);
				RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/healthcheck`, FeedBack);
				alert(Error.message);
			});
	};

	// Become Secondary
	const JoinAsSlave = (Button) => {
		Runtime.Get('CONTROLLER', 'beginJoiningNetwork').then((R) => {
			if (!R.callSuccess) {
				EnableButton(Button);
				alert(R.response);
			} else {
				const Result = R.response;
				switch (Result) {
					case 0:
						DisableButton(Button);
						break;
					case 1:
						alert('The Controller is currently too busy to perform the join.');
						break;
					case 2:
						alert("The Controller's role does not permit joining as a secondary controller - try resetting it!");
						break;
					case 3:
						alert('An unknown error occured.');
						break;
				}
			}
		});
	};

	// Give up Secondary Role
	const LeaveAsSlave = (Button) => {
		DisableButton(Button);
		Runtime.Get('CONTROLLER', 'beginLeavingNetwork').then((R) => {
			if (!R.callSuccess) {
				EnableButton(Button);
				alert(R.response);
			}
		});
	};

	// List Nodes
	const RefreshNodes = (Reason, NodeID) => {
		if (!networkId) {
			return;
		}

		switch (Reason) {
			case 'Refresh':
			case 'NetworkJoin':
			case 'NetworkLeft':
			case 'NetworkSelected':
				ClearSelection();
				CloseTray();
				break;

			case 'NodeAdded':
			case 'Named':
				break;

			case 'NodeRemoved':
				if (selectedNode && selectedNode.nodeId === NodeID) {
					ClearSelection();
				}
				break;
		}

		Runtime.Get('CONTROLLER', 'getNodes')
			.then((data) => {
				if (data.callSuccess) {
					data = data.response;

					const Controller = data.find((N) => N.isControllerNode);

					const Nodes = data.filter(
						(N) => !N.isControllerNode && (N.zwavePlusRoleType > 3 || N.zwavePlusRoleType === undefined)
					);

					const Info = `${Controller.deviceConfig.manufacturer} | ${Controller.deviceConfig.label} | v${Controller.firmwareVersion}`;
					$('#zwjs-controller-info').text(Info);
					$('#zwjs-controller-info').data('info', Controller);

					// Render List
					const TreeData = [];
					const getInitials = (name) => {
						if (!name) return '';
						return name
							.split(/\s+/)
							.map((word) => word[0] || '')
							.join('')
							.toUpperCase();
					};
					const groupedNodes = Nodes.reduce((acc, node) => {
						const location = node.nodeLocation || 'No Location';
						if (!acc[location]) {
							acc[location] = [];
						}
						acc[location].push(node);
						return acc;
					}, {});

					Object.keys(groupedNodes).forEach((LK) => {
						const GLabel = $(`<div><span class="zwjs-node-id">${getInitials(LK)}</span> ${LK}</div>`);
						const GIconSpan = $('<span group>').addClass('zwjs-node-state-group');
						GLabel.append(GIconSpan);
						GIconSpan.append('<i aria-hidden="true">Int</i>');
						GIconSpan.append('<i aria-hidden="true">Sta</i>');
						GIconSpan.append('<i aria-hidden="true">Pow</i>');
						GIconSpan.append('<i aria-hidden="true">Sec</i>');

						const Group = {
							id: `zwjs-node-list-entry-location-${LK.replace(/ /g, '-')}`,
							element: GLabel,
							children: [],
							expanded: nodesExpanded
						};

						TreeData.push(Group);

						groupedNodes[LK].forEach((N) => {
							const Label = $('<div>');
							Label.append(`<span class="zwjs-node-id">${N.nodeId}</span>`);
							Label.append(`<span id="zwjs-node-name-${N.nodeId}">${N.nodeName || 'No Name'}</span>`);
							const IconSpan = $('<span>').addClass('zwjs-node-state-group');
							Label.append(IconSpan);

							IconSpan.append(`<i id="zwjs-node-state-interview-${N.nodeId}" aria-hidden="true"></i>`);
							IconSpan.append(`<i id="zwjs-node-state-status-${N.nodeId}" aria-hidden="true"></i>`);
							IconSpan.append(`<i id="zwjs-node-state-power-${N.nodeId}" aria-hidden="true"></i>`);
							IconSpan.append(`<i id="zwjs-node-state-security-${N.nodeId}" aria-hidden="true"></i>`);

							Group.children.push({
								id: `zwjs-node-list-entry-${N.nodeId}`,
								element: Label,
								nodeData: N
							});
						});
					});

					$('#zwjs-node-list').treeList('data', TreeData);

					TreeData.forEach((G) => {
						G.children.forEach((N) => {
							if (N.nodeData) {
								RenderNodeIconState(N.nodeData);
							}
						});
					});
				} else {
					alert(data.response);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	// Reset Controller
	const ResetController = (Button) => {
		if (
			confirm(
				'Are you sure you wish to continue? This will reset the controller back to Factory Standard, and if operating as the Primary Controller - will clear the Network of all Nodes.'
			)
		) {
			DisableButton(Button);
			Runtime.Get('DRIVER', 'hardReset').then((R) => {
				if (!R.callSuccess) {
					EnableButton(Button);
					alert(R.response);
				} else {
					EnableButton(Button);
					alert('The Controller has been Reset - It will now be refreshed in the UI');
					CloseTray();
					NetworkSelected();
				}
			});
		}
	};

	// Restore Controller
	const RestoreController = (Button) => {
		if (
			confirm(
				'Note: This will alter the Controllers NVM, and will be configured according to the backup file you will restore to - Do you wish to comntinue?'
			)
		) {
			const promptFileUpload = () => {
				const fileInput = document.createElement('input');
				fileInput.type = 'file';
				fileInput.style.display = 'none';
				document.body.appendChild(fileInput);

				fileInput.addEventListener('change', async () => {
					const file = fileInput.files[0];
					if (!file) {
						alert('No file selected');
						document.body.removeChild(fileInput);
						return;
					}

					const reader = new FileReader();
					reader.onload = function (e) {
						const arrayBuffer = e.target.result;
						const byteArray = new Uint8Array(arrayBuffer);
						Runtime.Post('CONTROLLER', 'restoreNVM', [{ bytes: byteArray }]).then((R) => {
							if (!R.callSuccess) {
								EnableButton(Button);
								alert(R.response);
							} else {
								EnableButton(Button);
								alert('The restore has been completed! - Please allow a few minutes for the controller to reboot.');
							}
						});
					};
					reader.readAsArrayBuffer(file);
					document.body.removeChild(fileInput);
				});

				fileInput.click();
			};
			DisableButton(Button);
			promptFileUpload();
		}
	};

	// Backup Controller
	const BackupController = (Button) => {
		DisableButton(Button);
		Runtime.Get('CONTROLLER', 'backupNVMRaw').then((R) => {
			if (!R.callSuccess) {
				EnableButton(Button);
				alert(R.response);
			} else {
				const CD = $('#zwjs-controller-info').data('info');
				const FileName = `zwave_nvm_${CD.homeId}.bin`;

				const byteArray = Object.values(R.response);
				const uint8Array = new Uint8Array(byteArray);
				const blob = new Blob([uint8Array], { type: 'application/octet-stream' });
				const url = URL.createObjectURL(blob);

				const a = document.createElement('a');
				a.href = url;
				a.download = FileName;
				document.body.appendChild(a);
				alert(`Controller Backup is now completed, your browser will now downlaod the file: ${FileName}`);
				a.click();

				document.body.removeChild(a);
				URL.revokeObjectURL(url);

				setTimeout(() => {
					$('#zwjs-prog-contain-nvm').css({ display: 'none' });
				}, 100);

				EnableButton(Button);
			}
		});
	};

	// Render Advanded info (also used internally)
	const RenderFunctions = {
		RenderMap: () => {
			return new Promise(async (resolve) => {
				Runtime.Get('CONTROLLER', 'getNodes').then((data) => {
					if (data.callSuccess) {
						const nodes = data.response;

						let nodeString = '';
						let routeString = '';
						nodeString += '0(fa:fa-wifi<br />Controller)\r\n';

						const Nodes = nodes.filter((N) => !N.isControllerNode);
						Nodes.forEach((v) => {
							let Name;
							if (v.nodeName) {
								Name = `${v.nodeId} - ${v.nodeName}`;
							} else {
								Name = `${v.nodeId} - No Name`;
							}
							nodeString += `${v.nodeId}(fa:${v.powerSource.type === 'mains' ? 'fa-plug' : 'fa-battery-full'}<br />${Name}<br />RSSI: ${v.statistics?.rssi ?? '?'})\r\n`;
							if (v.statistics !== undefined && v.statistics.lwr !== undefined) {
								if (v.statistics.lwr.repeaters.length > 0) {
									const Repeaters = v.statistics.lwr.repeaters;
									if (Repeaters.length === 1) {
										routeString += `${Repeaters[0]} <---> ${v.nodeId}\r\n`;
									} else {
										routeString += `${Repeaters.join(' <---> ')}\r\n`;
									}
								} else {
									routeString += `0 <===> ${v.nodeId}\r\n`;
								}
							}
						});

						const result = `${nodeString}${routeString}`;
						resolve({ map: result });

						setTimeout(async () => {
							ZWJSMermaid.initialize({ startOnLoad: false });
							await ZWJSMermaid.run({
								querySelector: '.zwjs-mermaid'
							});
							svgPanZoom('.zwjs-mermaid svg', {
								zoomEnabled: true,
								controlIconsEnabled: true,
								panEnabled: true
							});
						}, 50);
					} else {
						alert(data.Response);
					}
				});
			});
		},
		PrepFailed: () => {
			return new Promise(async (resolve) => {
				Runtime.Get('CONTROLLER', 'getNodes').then((data) => {
					if (data.callSuccess) {
						const nodes = data.response.filter((N) => N.status === 'Dead');
						resolve({ nodes });
					} else {
						alert(data.Response);
					}
				});
			});
		},
		ControllerInfo: () => {
			return new Promise(async (resolve) => {
				const CD = $('#zwjs-controller-info').data('info');
				const versions = await Runtime.Get(undefined, undefined, `zwave-js/ui/${networkId}/version`);
				const Response = {
					configuration: $('#zwjs-network option:selected').text(),
					serialPort: RED.nodes.node(networkId).serialPort,
					...versions.response,
					...CD
				};
				resolve(Response);
			});
		},
		ControllerStats: () => {
			return new Promise(async (resolve) => {
				const CD = $('#zwjs-controller-info').data('info');
				resolve({ statistics: FormatObjectKeys(CD.statistics), backgroundRSSI: FormatObjectKeys(CD.backgroundRSSI) });
			});
		},
		ControllerSettings: () => {
			return new Promise(async (resolve) => {
				let Region = await Runtime.Get('CONTROLLER', 'getRFRegion');
				let RDisabled = '';
				if (Region.callSuccess) {
					Region = `0x${Region.response.toString(16).padStart(2, '0')}`;
				} else {
					RDisabled = 'disabled="disabled"';
				}

				let Power = await Runtime.Get('CONTROLLER', 'getPowerlevel');
				if (Power.callSuccess) {
					Power = Power.response.powerlevel;
				}

				let LRPower = await Runtime.Get('CONTROLLER', 'getMaxLongRangePowerlevel');
				if (LRPower.callSuccess) {
					LRPower = LRPower.response;
				}

				resolve({ Region, RDisabled, Power, LRPower });
			});
		},
		NodeInfo: () => {
			return new Promise(async (resolve) => {
				const ND = GetNodeGroup(selectedNode.nodeLocation).children.find(
					(N) => N.nodeData.nodeId === selectedNode.nodeId
				).nodeData;
				resolve(ND);
			});
		},
		NodeStats: () => {
			return new Promise(async (resolve) => {
				const ND = GetNodeGroup(selectedNode.nodeLocation).children.find(
					(N) => N.nodeData.nodeId === selectedNode.nodeId
				).nodeData;
				resolve(FormatObjectKeys(ND.statistics));
			});
		},
		NodeAssociationGroups: () => {
			return new Promise(async (resolve, reject) => {
				const Response = await Runtime.Post('CONTROLLER', 'getAllAssociationGroups', [selectedNode.nodeId]);
				if (Response.callSuccess) {
					AssociationGroups = Response.response;
					resolve(AssociationGroups);
				} else {
					reject(Response.response);
				}
			});
		},
		SetInclusionOptions: () => {
			return new Promise(async (resolve) => {
				setTimeout(() => {
					const S0K = RED.nodes.node(networkId).securityKeys_S0_Legacy;
					const S2ACK = RED.nodes.node(networkId).securityKeys_S2_AccessControl;
					const S2AK = RED.nodes.node(networkId).securityKeys_S2_Authenticated;
					const S2UK = RED.nodes.node(networkId).securityKeys_S2_Unauthenticated;

					if (S2ACK.length < 32 || S2AK.length < 32 || S2UK.length < 32) {
						[
							'input[type="radio"][name="ZWJS_IS"][value="0"]',
							'input[type="radio"][name="ZWJS_IS"][value="4"]',
							'input[type="radio"][name="ZWJS_IS"][value="SS"]'
						].forEach((EL) => {
							$(EL).attr('disabled', 'disabled');
							$(EL).parent().css({ opacity: 0.4 });
						});
						$('input[type="radio"][name="ZWJS_IS"][value="2"]').prop('checked', true);
					}

					if (S0K.length < 32) {
						['input[type="radio"][name="ZWJS_IS"][value="3"]'].forEach((EL) => {
							$(EL).attr('disabled', 'disabled');
							$(EL).parent().css({ opacity: 0.4 });
						});

						if (S2ACK.length < 32 || S2AK.length < 32 || S2UK.length < 32) {
							$('input[type="radio"][name="IS"][value="2"]').prop('checked', true);
						}
					}
				}, 10);

				resolve({});
			});
		},
		StartCamera: () => {
			setTimeout(() => {
				const Options = {
					highlightCodeOutline: true,
					highlightScanRegion: true,
					calculateScanRegion: () => {
						const ve = $('#zwjs-camera-view')[0];
						const sd = Math.min(ve.videoWidth, ve.videoHeight);
						const srz = Math.round(0.5 * sd);

						const region = {
							x: Math.round((ve.videoWidth - srz) / 2),
							y: Math.round((ve.videoHeight - srz) / 2),
							width: srz,
							height: srz
						};
						return region;
					}
				};

				const EL = $('#zwjs-camera-view')[0];
				const Handler = (result) => {
					QRS.stop();
					Runtime.Post(undefined, undefined, [result.data], `zwave-js/ui/${networkId}/s2/parseqr`).then((R) => {
						if (R.callSuccess) {
							if (R.response.isDSK) {
								alert('The QR Code you have scanned, is a DSK (Device Specific Key), it is not a Smart Start QR Code');
								QRS.start();
							} else {
								const Classes = [];
								R.response.qrProvisioningInformation.requestedSecurityClasses.forEach((SC) => {
									Classes.push({
										classId: SC,
										className: SClassMap[SC]
									});
								});

								R.response.qrProvisioningInformation.manufacturer = R.response.deviceConfig.manufacturer;
								R.response.qrProvisioningInformation.label = R.response.deviceConfig.label;

								RenderAdvanced('ZWJS_TPL_PrePro', undefined, {
									QRProvisioningInformation: btoa(JSON.stringify(R.response.qrProvisioningInformation)),
									DSK: R.response.qrProvisioningInformation.dsk,
									DeviceConfig: R.response.deviceConfig,
									classes: Classes
								});
							}
						} else {
							alert(R.response);
							QRS.start();
						}
					});
				};

				QRS = new QrScanner(EL, Handler, Options);
				QRS.start();
			}, 50);
		},

		PrepSSList: () => {
			return new Promise((resolve, reject) => {
				Runtime.Get(undefined, undefined, `zwave-js/ui/${networkId}/s2/provisioningentries`).then((R) => {
					if (R.callSuccess) {
						R.response.forEach((E) => {
							E.shortDSK = E.dsk.split('-')[0];
							if (E.status === 0) {
								E.checked = 'checked';
							}
						});
						resolve({ entries: R.response });
					} else {
						reject(R.response);
					}
				});
			});
		}
	};

	// Update Controller Firmware
	const UpdateCFirmware = (Button) => {
		if (confirm('Note: This will update the Controllers firmware, do you wish to proceed?')) {
			const promptFileUpload = () => {
				const fileInput = document.createElement('input');
				fileInput.type = 'file';
				fileInput.style.display = 'none';
				document.body.appendChild(fileInput);

				fileInput.addEventListener('change', async () => {
					const file = fileInput.files[0];
					if (!file) {
						alert('No file selected');
						document.body.removeChild(fileInput);
						return;
					}

					DisableButton(Button);
					const reader = new FileReader();
					reader.onload = function (e) {
						const arrayBuffer = e.target.result;
						const byteArray = new Uint8Array(arrayBuffer);
						// Handled in COMMS
						Runtime.Post('DRIVER', 'firmwareUpdateOTW', [{ bytes: byteArray }]);
					};
					reader.readAsArrayBuffer(file);
					document.body.removeChild(fileInput);
				});

				fileInput.click();
			};

			promptFileUpload();
		}
	};

	/*
	 * Driver COMMS Callbacks
	 * Methods here are those used in the subscriptions to the COMMS api
	 */

	// Rebuild Routes Progress
	const commsRebuildRoutesProgress = (topic, data) => {
		const nodes = {};
		const table = $('#zwjs-routes-progress')[0];
		for (const [node, status] of Object.entries(data.Progress)) {
			nodes[node] = status;
		}
		const groups = {
			pending: [],
			done: [],
			failed: [],
			skipped: []
		};
		for (const [node, status] of Object.entries(nodes)) {
			groups[status].push(node);
		}
		const maxRows = Math.max(groups.pending.length, groups.done.length, groups.failed.length, groups.skipped.length);
		while (table.rows.length > 1) {
			table.deleteRow(1);
		}
		for (let i = 0; i < maxRows; i++) {
			const row = table.insertRow();
			['pending', 'done', 'failed', 'skipped'].forEach((col) => {
				const cell = row.insertCell();
				cell.style.textAlign = 'center';
				if (groups[col][i] !== undefined) {
					cell.textContent = groups[col][i];
				}
			});
		}
	};

	// Controller, Driver Status
	const commsStatus = (topic, data) => {
		$('#zwjs-controller-status').text(data.status);
		$('#zwjs-controller-status-tray').text(data.status);
	};

	// Node Status
	const commsNodeState = (topic, data) => {
		GetNodeGroup(data.nodeInfo.nodeLocation).children.find((N) => N.nodeData.nodeId === data.nodeInfo.nodeId).nodeData =
			data.nodeInfo;

		if (selectedNode && selectedNode.nodeId === data.nodeInfo.nodeId) {
			nodeSelected(undefined, { nodeData: data.nodeInfo });
		}

		RenderNodeIconState(data.nodeInfo);
	};

	// Node Added
	const commsNodeAdded = (topic, data) => {
		RefreshNodes('NewAdded', data.nodeId);
		RenderAdvanced('ZWJS_TPL_NAdded', undefined, data);
	};

	// Node Removed
	const commsNodeRemoved = (topic, data) => {
		RefreshNodes('NodeRemoved', data.nodeId);
		RenderAdvanced('ZWJS_TPL_NRemoved', undefined, data);
	};

	// Value Update
	const commsHandleValueUpdate = (topic, data) => {
		if (selectedNode) {
			const ValueID = data.eventBody.valueId;
			const NewValue = data.eventBody.newValue;
			const Hash = getValueUpdateHash(ValueID);

			if (SelectedNodeVIDs[Hash]) {
				SelectedNodeVIDs[Hash].currentValue = NewValue;
			}

			const TargetElement = `#zwjs-value-${Hash}`;
			if ($(TargetElement).length > 0) {
				$(TargetElement).text(NewValue);
			}
		}
	};

	// Slave Join/Leave Evenst
	const commsHandleSlaveOps = (topic, data) => {
		if (topic.endsWith('dsk')) {
			data.slaveJoinDSK = data.slaveJoinDSK.toString().substring(0, 5);

			RenderAdvanced('ZWJS_TPL_Tray-Controller-Slave-DSK', undefined, data);
		}

		if (topic.endsWith('joined')) {
			CloseTray();
			RefreshNodes('NetworkJoin');
		}

		if (topic.endsWith('left')) {
			CloseTray();
			RefreshNodes('NetworkLeft');
		}
	};

	// Promot Sec Classes
	const commsGrant = (topic, data) => {
		clientSideAuth = data.clientSideAuth;

		const Classes = [];
		data.securityClasses.forEach((SC) => {
			Classes.push({
				classId: SC,
				className: SClassMap[SC]
			});
		});
		RenderAdvanced('ZWJS_TPL_SecurityGrant', undefined, { classes: Classes });
	};

	// Promot DSk entering
	const commsDSK = (topic, data) => {
		RenderAdvanced('ZWJS_TPL_DSK', undefined, data);
	};

	// NVM Restore Progress
	const commsNVMRestoreProgressReport = (topic, data) => {
		$('#zwjs-prog-contain-nvm').css({ display: 'block' });
		const Done = data.done;
		const Total = data.total;
		const Percentage = (Done / Total) * 100;
		$('#zwjs-prog-bar-nvm').css({ width: `${Percentage}%` });
		$('#zwjs-prog-bar-nvm').text(`${data.label} ${Math.round(Percentage)}%`);
	};

	// NVM Backup Progress
	const commsNVMBackupProgressReport = (topic, data) => {
		$('#zwjs-prog-contain-nvm').css({ display: 'block' });
		const Read = data.bytesRead;
		const Total = data.total;
		const Percentage = (Read / Total) * 100;
		$('#zwjs-prog-bar-nvm').css({ width: `${Percentage}%` });
		$('#zwjs-prog-bar-nvm').text(`${data.label} ${Math.round(Percentage)}%`);
	};

	// Controller Firmware Update Callbacks
	const commsCFirmwareReport = (topic, data) => {
		if (topic.endsWith('progress')) {
			$('#zwjs-prog-contain-cfirmware').css({ display: 'block' });
			const Percentage = data.progress;
			$('#zwjs-prog-bar-cfirmware').css({ width: `${Percentage}%` });
			$('#zwjs-prog-bar-cfirmware').text(`Flashing Chip... ${Math.round(Percentage)}%`);
		}

		if (topic.endsWith('finished')) {
			let Message;
			switch (data.status) {
				case 0:
					Message = 'A timeout occured';
					break;
				case 1:
					Message = 'The maximum number of retry attempts for a firmware fragments were reached';
					break;
				case 2:
					Message = 'The update was aborted by the bootloader';
					break;
				case 3:
					Message = 'This controller does not support firmware updates';
					break;

				default:
					Message = 'The update was successfull, please a few minutes for the Controller to reinitialize';
			}
			RenderAdvanced('ZWJS_TPL_Tray-Controller-Firmware-Done', undefined, { Message });
		}
	};

	// Remove Shutdown Runtime
	const commsRemoveNetwork = (network) => {
		const Networks = $('#zwjs-network');
		if (Networks.val() === network.id) {
			ClearSelection(true);
		}

		Networks.children(`option[value="${network.id}"]`).remove();
		SelectFirstNetwork();
	};

	// Add runtime (used internally also)
	const commsListOrAddNetworks = (search, network) => {
		const Networks = $('#zwjs-network');
		if (search) {
			setTimeout(() => {
				RED.nodes.eachConfig((c) => {
					if (c.type === 'zwavejs-runtime' && c.d !== true) {
						const found = Networks.children().filter((n) => n.val === c.id);
						if (found.length < 1) {
							Networks.append(new Option(c.name, c.id));
						}
					}
				});
				SelectFirstNetwork();
			}, 1000);
		} else {
			const found = Networks.children().filter((n) => n.val === network.id);
			if (found.length < 1) {
				Networks.append(new Option(network.name, network.id));
			}
			SelectFirstNetwork();
		}
	};

	/*
	 * Helpers/Things
	 * Methods/things used in all this vortex of chaos!
	 */

	// Get Node Group
	const GetNodeGroup = (Group) => {
		const safeGroup = Group && Group.trim() !== '' ? Group : 'No Location';
		const G = `zwjs-node-list-entry-location-${safeGroup.replace(/ /g, '-')}`;
		return $('#zwjs-node-list')
			.treeList('data')
			.find((N) => N.id === G);
	};

	// Fomat Object
	const FormatObjectKeys = (obj) => {
		const formatted = {};

		for (const key in obj) {
			const title = key
				.replace(/([a-z])([A-Z])/g, '$1 $2') // lowercase followed by uppercase
				.replace(/([a-zA-Z])([0-9]+)/g, '$1 $2') // letters followed by numbers
				.replace(/([0-9]+)([a-zA-Z])/g, '$1 $2') // numbers followed by letters
				.replace(/^./, (str) => str.toUpperCase()); // capitalize first letter

			formatted[title] = obj[key];
		}

		return formatted;
	};

	// Flatten RSSI
	const FlattenChannelAverages = (backgroundRSSI) => {
		const flattenedRSSI = {};
		for (const key in backgroundRSSI) {
			if (key.startsWith('channel')) {
				flattenedRSSI[`${key}average`] = backgroundRSSI[key].average;
			} else {
				flattenedRSSI[key] = backgroundRSSI[key];
			}
		}

		return flattenedRSSI;
	};

	// Hashes the ValueID - so we can  identify it with a simple hash
	const getValueUpdateHash = (Obj) => {
		Obj = JSON.stringify(Obj);
		Obj = `${selectedNode.nodeId}${Obj}`;
		let hash = 5381;
		for (let i = 0; i < Obj.length; i++) {
			hash = (hash << 5) + hash + Obj.charCodeAt(i);
		}
		return (hash >>> 0).toString(16);
	};

	// Renders the button disabled
	const DisableButton = (Button) => {
		$(Button).data('original_text', $(Button).text());
		$(Button).text('Please wait...');
		$(Button).prop('disabled', true);
	};

	// Renders the button enabled
	const EnableButton = (Button) => {
		$(Button).text($(Button).data('original_text'));
		$(Button).prop('disabled', false);
	};

	// Decodes an object that has been converted to Base64 (serialised via a HB function (json) - found in the init method)
	const DecodeObject = (Item) => {
		const decoded = new TextDecoder().decode(Uint8Array.from(atob(Item), (c) => c.charCodeAt(0)));
		return JSON.parse(decoded);
	};

	// The JSON formatter, used to present sexy json (root created at top of this file)
	const JSONFormatter = {
		json: {
			replacer: function (match, pIndent, pKey, pVal, pEnd) {
				var key = '<span class=zwjs-json-key>';
				var val = '<span class=zwjs-json-value>';
				var str = '<span class=zwjs-json-string>';
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
		}
	};

	// The COMMS Sub/Unsub method
	const setSubscription = (subscribe) => {
		const Hooks = [
			{ address: `zwave-js/ui/${networkId}/status`, method: commsStatus },
			{ address: `zwave-js/ui/${networkId}/s2/grant`, method: commsGrant },
			{ address: `zwave-js/ui/${networkId}/s2/dsk`, method: commsDSK },
			{ address: `zwave-js/ui/${networkId}/nodes/added`, method: commsNodeAdded },
			{ address: `zwave-js/ui/${networkId}/nodes/removed`, method: commsNodeRemoved },
			{ address: `zwave-js/ui/${networkId}/nodes/interviewstarted`, method: commsNodeState },
			{ address: `zwave-js/ui/${networkId}/nodes/interviewfailed`, method: commsNodeState },
			{ address: `zwave-js/ui/${networkId}/nodes/interviewed`, method: commsNodeState },
			{ address: `zwave-js/ui/${networkId}/nodes/ready`, method: commsNodeState },
			{ address: `zwave-js/ui/${networkId}/nodes/sleep`, method: commsNodeState },
			{ address: `zwave-js/ui/${networkId}/nodes/awake`, method: commsNodeState },
			{ address: `zwave-js/ui/${networkId}/nodes/dead`, method: commsNodeState },
			{ address: `zwave-js/ui/${networkId}/controller/slave/dsk`, method: commsHandleSlaveOps },
			{ address: `zwave-js/ui/${networkId}/controller/slave/joined`, method: commsHandleSlaveOps },
			{ address: `zwave-js/ui/${networkId}/controller/slave/left`, method: commsHandleSlaveOps },
			{ address: `zwave-js/ui/${networkId}/nodes/valueadded`, method: commsHandleValueUpdate },
			{ address: `zwave-js/ui/${networkId}/nodes/valueupdate`, method: commsHandleValueUpdate },
			{ address: `zwave-js/ui/${networkId}/controller/nvm/backupprogress`, method: commsNVMBackupProgressReport },
			{ address: `zwave-js/ui/${networkId}/controller/nvm/restoreprogress`, method: commsNVMRestoreProgressReport },
			{ address: `zwave-js/ui/${networkId}/driver/firmwareupdate/progress`, method: commsCFirmwareReport },
			{ address: `zwave-js/ui/${networkId}/driver/firmwareupdate/finished`, method: commsCFirmwareReport },
			{ address: `zwave-js/ui/${networkId}/rebuildroutes/progress`, method: commsRebuildRoutesProgress }
		];

		const op = RED.comms[subscribe ? 'subscribe' : 'unsubscribe'];
		Hooks.forEach((H) => op(H.address, H.method));
	};

	// Tray Close
	const CloseTray = () => {
		// Kill Scanner
		if (QRS) {
			QRS.destroy();
			QRS = undefined;
		}

		// Kill any outstanding network task (we dont really need to await these)
		Runtime.Get('CONTROLLER', 'stopInclusion');
		Runtime.Get('CONTROLLER', 'stopExclusion');
		Runtime.Get('CONTROLLER', 'stopJoiningNetwork');
		Runtime.Get('CONTROLLER', 'stopLeavingNetwork');

		// Finally Close Tray
		RED.tray.close();
	};

	// Render Node Icons (status and stuff)
	const RenderNodeIconState = (Node) => {
		const el_interview = $(`#zwjs-node-state-interview-${Node.nodeId}`);
		const el_status = $(`#zwjs-node-state-status-${Node.nodeId}`);
		const el_power = $(`#zwjs-node-state-power-${Node.nodeId}`);
		const el_security = $(`#zwjs-node-state-security-${Node.nodeId}`);

		el_interview.removeClass();
		el_status.removeClass();
		el_power.removeClass();
		el_security.removeClass();

		if (Node.interviewStage !== 'Complete') {
			el_interview.addClass(['fa', 'fa-handshake-o', 'zwjs-state-amber']);
			RED.popover.tooltip(el_interview, 'Pending Interview');
		} else {
			el_interview.addClass(['fa', 'fa-check', 'zwjs-state-green']);
			RED.popover.tooltip(el_interview, 'Fully Interviewed');
		}

		switch (Node.status) {
			case 'Alive':
				el_status.addClass(['fa', 'fa-sun-o', 'zwjs-state-green']);
				RED.popover.tooltip(el_status, 'Alive/Awake');
				break;
			case 'Asleep':
				el_status.addClass(['fa', 'fa-moon-o', 'zwjs-state-amber']);
				RED.popover.tooltip(el_status, 'Alseep');
				break;
			case 'Dead':
				el_status.addClass(['fa', 'fa-exclamation-triangle', 'zwjs-state-red']);
				RED.popover.tooltip(el_status, 'Dead/Not Responding');
				break;
			case 'Unknown':
				el_status.addClass(['fa', 'fa-question-circle', 'zwjs-state-red']);
				RED.popover.tooltip(el_status, 'Dead/Not Responding');
				break;
		}

		if (Node.powerSource.type === 'mains') {
			el_power.addClass(['fa', 'fa-plug', 'zwjs-state-green']);
			RED.popover.tooltip(el_power, 'Mains Powered');
		} else {
			el_power.removeClass(
				'fa-battery-empty fa-battery-quarter fa-battery-half fa-battery-three-quarters fa-battery-full'
			);
			RED.popover.tooltip(el_power, `Battery Powered: (${Node.powerSource.level}%)`);

			el_power.addClass('fa');

			if (Node.powerSource.level <= 10) {
				el_power.addClass('fa-battery-empty');
			} else if (Node.powerSource.level <= 25) {
				el_power.addClass('fa-battery-quarter');
			} else if (Node.powerSource.level <= 75) {
				el_power.addClass('fa-battery-half');
			} else if (Node.powerSource.level <= 85) {
				el_power.addClass('fa-battery-three-quarters');
			} else {
				el_power.addClass('fa-battery-full');
			}

			if (Node.powerSource.isLow) {
				el_power.addClass('zwjs-state-red');
			} else {
				el_power.addClass('zwjs-state-green');
			}
		}

		const GetSecurityClassLabel = (SC) => {
			switch (SC) {
				case 0:
					return 'S2 | Unauthenticated';

				case 1:
					return 'S2 | Authenticated';

				case 2:
					return 'S2 | Access Control';

				case 7:
					return 'S0 | Legacy';

				default:
					return 'No Security';
			}
		};

		switch (Node.highestSecurityClass) {
			case 0:
			case 1:
			case 2:
				el_security.addClass(['fa', 'fa-lock', 'zwjs-state-green']);
				RED.popover.tooltip(el_security, GetSecurityClassLabel(Node.highestSecurityClass));
				break;
			case 7:
				el_security.addClass(['fa', 'fa-lock', 'zwjs-state-amber']);
				RED.popover.tooltip(el_security, GetSecurityClassLabel(Node.highestSecurityClass));
				break;

			default:
				el_security.addClass(['fa', 'fa-unlock-alt', 'zwjs-state-red']);
				RED.popover.tooltip(el_security, GetSecurityClassLabel(Node.highestSecurityClass));
				break;
		}
	};

	// Just a map of Sec classes to names
	const SClassMap = {
		0: 'S2 Unauthenticated',
		1: 'S2 Authenticated',
		2: 'S2 AccessControl',
		7: 'S0 Legacy'
	};

	/*
	 * Internal events/methods
	 * Such as a Node/CC being being selected, or something that needs exra work
	 */

	// Node Selected
	const nodeSelected = (event, item) => {
		if (!item.nodeData) {
			return;
		}

		selectedNode = item.nodeData;
		SelectedNodeVIDs = {};

		$('#zwjs-endpoint-list').empty();
		$('#zwjs-cc-list').treeList('empty');
		$('#zwjs-node-status').text(selectedNode.status);
		$('#zwjs-node-info-id').text(selectedNode.nodeId);
		CloseTray();

		if (selectedNode.interviewStage !== 'Complete') {
			$('#zwjs-node-info').text(`Node Interview Stage : ${selectedNode.interviewStage}`);
			//	return;
		}

		const Info = `${selectedNode.deviceConfig.manufacturer} | ${selectedNode.deviceConfig.label} | v${selectedNode.firmwareVersion}`;
		$('#zwjs-node-info').text(Info);

		Runtime.Post('DRIVER', 'getValueDB', [selectedNode.nodeId])
			.then((data) => {
				if (data.callSuccess) {
					data = data.response[0];

					const groupByEP = function (xs) {
						return xs.reduce(function (rv, x) {
							(rv[x.valueId.endpoint] = rv[x.valueId.endpoint] || []).push(x);
							return rv;
						}, {});
					};

					const EPGroups = groupByEP(data.values);
					const EPIDs = Object.keys(EPGroups);

					EPIDs.forEach((E) => {
						const EP = E === '0' ? 'Root' : `EP${E}`;
						const Button = $(`<div data-endpoint="${E}">${EP}</div>`);
						Button.click(() => {
							listCCs(EPGroups[E]);
							$('#zwjs-endpoint-list > div').removeAttr('selected');
							$(`#zwjs-endpoint-list > div[data-endpoint="${E}"]`).attr('selected', 'selected');
						});
						$('#zwjs-endpoint-list').append(Button);
					});

					listCCs(EPGroups['0']);
					$('#zwjs-endpoint-list > div[data-endpoint="0"]').attr('selected', 'selected');
				} else {
					alert(data.response);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	// EP Selected
	const listCCs = (Collection) => {
		const groupByCC = function (xs) {
			return xs.reduce(function (rv, x) {
				(rv[x.valueId.commandClass] = rv[x.valueId.commandClass] || []).push(x);
				return rv;
			}, {});
		};

		const CCGroups = groupByCC(Collection);
		const CCGroupIDs = Object.keys(CCGroups);

		const Items = [];

		CCGroupIDs.forEach((CCID) => {
			const Name = CCGroups[CCID][0].valueId.commandClassName;
			const Item = {
				element: `<div><span class="zwjs-cc-id">0x${parseInt(CCID).toString(16).padStart(2, '0').toUpperCase()}</span> - ${Name}</div>`,
				children: [],
				parent: true
			};

			CCGroups[CCID].forEach((V) => {
				const getCurrentValue = (value) => {
					let Display;
					if (value !== undefined) {
						if (typeof value === 'object' && !Array.isArray(value)) {
							Display = '(Complex)';
						} else {
							Display = `${value} ${V.metadata.unit || ''}`;
						}
						return `<span class="zwjs-cc-value" id="zwjs-value-${getValueUpdateHash(V.valueId)}" style="padding:1px;float:right;color:rgb(46, 145, 205); min-width:80px">${Display}</span>`;
					} else {
						return '';
					}
				};

				SelectedNodeVIDs[getValueUpdateHash(V.valueId)] = {
					metadata: V.metadata,
					valueId: V.valueId,
					currentValue: V.currentValue
				};

				const sItem = {
					element: `<div style="width:100%; margin-right:30px">${V.metadata.label} ${getCurrentValue(V.currentValue)}</div>`,
					icon: V.metadata.writeable ? 'fa fa-pencil' : '',
					parent: false,
					valueInfo: SelectedNodeVIDs[getValueUpdateHash(V.valueId)]
				};

				Item.children.push(sItem);
			});

			Items.push(Item);
		});

		$('#zwjs-cc-list').treeList('empty');
		$('#zwjs-cc-list').treeList('data', Items);
		$('#zwjs-cc-list').on('treelistselect', function (event, item) {
			if (Object.keys(item).length < 1 || item.parent === true) {
				return;
			}
			CloseTray();
			const Options = {
				width: 700,
				title: 'Value Management',
				buttons: [
					{
						id: 'zwjs-tray-about',
						text: 'About Zwave JS',
						click: function () {
							CloseTray();
						}
					},
					{
						id: 'zwjs-tray-close',
						text: 'Close',
						click: function () {
							CloseTray();
						}
					}
				],
				open: function (tray) {
					const trayBody = tray.find('.red-ui-tray-body, .editor-tray-body');

					let Property;
					if (typeof item.valueInfo.valueId.property === 'number') {
						Property = `0x${parseInt(item.valueInfo.valueId.property).toString(16).padStart(2, '0').toUpperCase()}`;
					} else {
						Property = item.valueInfo.valueId.property;
					}

					if (item.valueInfo.valueId.propertyKey) {
						if (typeof item.valueInfo.valueId.propertyKey === 'number') {
							Property += ` / 0x${parseInt(item.valueInfo.valueId.propertyKey).toString(16).padStart(2, '0').toUpperCase()}`;
						} else {
							Property += ` / ${item.valueInfo.valueId.propertyKey}`;
						}
					}

					const State = {
						ccId: `0x${parseInt(item.valueInfo.valueId.commandClass).toString(16).padStart(2, '0').toUpperCase()}`,
						ccName: item.valueInfo.valueId.commandClassName,
						valueLabel: item.valueInfo.metadata.label,
						nodeId: selectedNode.nodeId,
						property: Property,
						editInfo: {
							valueLabel: item.valueInfo.metadata.label,
							valueId: item.valueInfo.valueId,
							writeable: item.valueInfo.metadata.writeable,
							currentValue: item.valueInfo.currentValue,
							type: item.valueInfo.metadata.type,
							states: item.valueInfo.metadata.states,
							allowManualEntry:
								item.valueInfo.metadata.allowManualEntry !== undefined
									? item.valueInfo.metadata.allowManualEntry
									: item.valueInfo.metadata.writeable
						}
					};

					State.examples = {
						valueLabel: item.valueInfo.metadata.label,
						nocmd: {
							payload: {
								cmd: {
									api: 'VALUE'
								},
								cmdProperties: {
									nodeId: selectedNode.nodeId,
									valueId: { ...item.valueInfo.valueId }
								}
							}
						},
						cmd: {
							topic: selectedNode.nodeId,
							valueId: { ...item.valueInfo.valueId }
						}
					};

					if (item.valueInfo.metadata.valueChangeOptions) {
						State.examples.cmd.options = {};
						State.examples.nocmd.payload.cmdProperties.setValueOptions = {};

						item.valueInfo.metadata.valueChangeOptions.forEach((OP) => {
							State.examples.cmd.options[OP] = SetValueOptionExamples[OP];
							State.examples.nocmd.payload.cmdProperties.setValueOptions[OP] = SetValueOptionExamples[OP];
						});
					}

					delete State.examples.cmd.valueId.commandClassName;
					delete State.examples.cmd.valueId.propertyName;
					delete State.examples.cmd.valueId.propertyKeyName;
					delete State.examples.nocmd.payload.cmdProperties.valueId.commandClassName;
					delete State.examples.nocmd.payload.cmdProperties.valueId.propertyName;
					delete State.examples.nocmd.payload.cmdProperties.valueId.propertyKeyName;

					if (item.valueInfo.metadata.writeable) {
						State.examples.nocmd.payload.cmd.method = 'setValue | getValue';
						State.examples.nocmd.payload.cmdProperties.value = item.valueInfo.currentValue;
						State.examples.cmd.payload = item.valueInfo.currentValue;
					} else {
						State.examples.nocmd.payload.cmd.method = 'getValue';
					}

					trayBody.append(TPL_ValueManagement(State));

					setTimeout(() => {
						$('.zwjs-tray-menu > div[default]').trigger('click');
					}, 250);
				}
			};
			RED.tray.show(Options);
		});
	};

	// Clear context of Network, Node and others
	const ClearSelection = (Controller) => {
		$('#zwjs-node-info-id').text('--');
		$('#zwjs-node-info').text('No Node Selected');
		$('#zwjs-endpoint-list').empty();
		$('#zwjs-node-status').empty();
		$('#zwjs-cc-list').treeList('empty');
		$('#zwjs-node-list').treeList('empty');
		selectedNode = undefined;

		if (Controller) {
			$('#zwjs-controller-info').text('No Network Selected');
			$('#zwjs-controller-status').empty();
			networkId = undefined;
		}
	};

	// Do the Asso adding (after removal)
	const CommitAssociationsAdd = (Button) => {
		const Addresses = [];
		$("[data-role='zwjs-new-association']").each(function () {
			const Node = parseInt($(this).find("[data-role='zwjs-node']").first().val());
			let Endpoint = parseInt($(this).find("[data-role='zwjs-endpoint']").first().val());
			if (isNaN(Endpoint)) {
				Endpoint = undefined;
			}
			Addresses.push({ nodeId: Node, endpoint: Endpoint });
		});

		if (Addresses.length > 0) {
			const Params = [
				{ nodeId: selectedNode.nodeId, endpoint: parseInt($('#zwjs-asso-endpoints').val()) },
				parseInt($('#zwjs-asso-groups').val()),
				Addresses
			];
			Runtime.Post('CONTROLLER', 'addAssociations', Params)
				.then((response) => {
					if (response.callSuccess) {
						alert('Associations have been successfully updated!');
						EnableButton(Button);
						processAssociationGPSelect();
					} else {
						EnableButton(Button);
						alert(response.response);
					}
				})
				.catch((Error) => {
					alert(Error.message);
				});
		} else {
			alert('Associations have been successfully updated!');
			EnableButton(Button);
			processAssociationGPSelect();
		}
	};

	// Attempst to select the only active network
	const SelectFirstNetwork = () => {
		const Networks = $('#zwjs-network');
		if (Networks.children().length === 2) {
			const Value = Networks.children().eq(1).val();
			Networks.val(Value);
			NetworkSelected();
		}
	};

	return {
		init,
		NetworkSelected,
		ShowNetworkManagement,
		ShowNodeManagement,
		InterviewCurrentNode,
		RenderAdvanced,
		StartInclusion,
		StartExclusion,
		GrantClasses,
		SubmitDSK,
		SubmitProvisioningEntry,
		SetPEActive,
		DeletePE,
		SetNameLocation,
		processAssociationEPSelect,
		processAssociationGPSelect,
		PreppNewAssociation,
		CommitAssociations,
		ResetAllAssociations,
		MarkAssoDelete,
		CheckNodeHealth,
		JoinAsSlave,
		LeaveAsSlave,
		RefreshNodes,
		ResetController,
		BackupController,
		RestoreController,
		UpdateCFirmware,
		SetClassicPowerLevel,
		SetLWPowerLevel,
		SetRegion,
		RemoveFailedNode,
		NodeCollapseToggle,
		UpdateValue,
		PingNode,
		RebuildRoutes
	};
})();
