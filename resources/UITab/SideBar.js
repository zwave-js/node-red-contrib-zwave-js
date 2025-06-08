/* eslint-disable prefer-const */
/* eslint-env jquery */
/* eslint-env browser */
/* eslint no-undef: "warn"*/
/* eslint no-unused-vars: "warn"*/
const ZWaveJS = (function () {
	let networkId = undefined;
	let selectedNode = undefined;
	let lastInterviewedNode = undefined;
	const AdvancedPanels = [];
	let QRS;

	let TPL_SidePanel = undefined;
	let TPL_ControllerManagement = undefined;
	let TPL_NodeManagement = undefined;

	// Runtime event Callbacks
	const commsStatus = (topic, data) => {
		$('#zwjs-controller-status').text(data.status);
		$('#zwjs-controller-status-tray').text(data.status);
	};
	const commsNodeState = (topic, data) => {
		$('#zwjs-node-list')
			.treeList('data')
			.find((N) => N.nodeData.nodeId === data.nodeInfo.nodeId).nodeData = data.nodeInfo;

		if (selectedNode && selectedNode.nodeId === data.nodeInfo.nodeId) {
			nodeSelected(undefined, { nodeData: data.nodeInfo });
		}

		RenderNodeIconState(data.nodeInfo);
	};
	const commsNodeAdded = (topic, data) => {
		RefreshNodes();
		RenderAdvanced('ZWJS_TPL_NAdded', undefined, data);
	};
	const commsNodeRemoved = (topic, data) => {
		RefreshNodes();
		RenderAdvanced('ZWJS_TPL_NRemoved', undefined, data);
	};

	let clientSideAuth = false;
	const SClassMap = {
		0: 'S2 Unauthenticated',
		1: 'S2 Authenticated',
		2: 'S2 AccessControl',
		7: 'S0 Legacy'
	};

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
	const commsDSK = (topic, data) => {
		RenderAdvanced('ZWJS_TPL_DSK', undefined, data);
	};

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

	const StartExclusion = () => {
		Runtime.Post('CONTROLLER', 'beginExclusion').then((R) => {
			if (R.callSuccess) {
				RenderAdvanced('ZWJS_TPL_NIFWait', undefined, { mode: 'Exclusion' });
			} else {
				alert(R.response);
			}
		});
	};

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

	const SubmitDSK = (Button) => {
		Runtime.Post(undefined, undefined, [$('#zwjs-dsk').val()], `zwave-js/ui/${networkId}/s2/dsk`).then((R) => {
			if (R.callSuccess) {
				$(Button).text('Please wait...');
				$(Button).prop('disabled', true);
			} else {
				alert(R.response);
			}
		});
	};

	const SubmitProvisioningEntry = (Button) => {
		$(Button).text('Please wait...');
		$(Button).prop('disabled', true);

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

	const SetPEActive = (El, Entry) => {
		Entry = JSON.parse(atob(Entry));
		delete Entry.checked;
		delete Entry.shortDSK;
		delete Entry.B64;
		Entry.status = $(El).prop('checked') ? 0 : 1;

		Runtime.Post('CONTROLLER', 'provisionSmartStartNode', [Entry]).then((R) => {
			if (!R.callSuccess) {
				alert(R.response);
			}
		});
	};

	const DeletePE = (El, Entry) => {
		if (confirm('Are you sure you wish to delete this Provisioning Entry? Note: it will not exclude the device.')) {
			Entry = JSON.parse(atob(Entry));
			delete Entry.checked;
			delete Entry.shortDSK;
			delete Entry.B64;
			Runtime.Post('CONTROLLER', 'unprovisionSmartStartNode', [Entry.dsk]).then((R) => {
				if (R.callSuccess) {
					$(El).parent().parent().remove();
				} else {
					alert(R.response);
				}
			});
		}
	};

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
				$(Button).text('Please wait...');
				$(Button).prop('disabled', true);
			} else {
				alert(R.response);
			}
		});
	};

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

	const SetNameLocation = () => {
		Runtime.Post('NODE', 'setName', { nodeId: selectedNode.nodeId, value: $('#zwjs-node-edit-name').val() })
			.then((data) => {
				if (!data.callSuccess) {
					alert(data.response);
				} else {
					Runtime.Post('NODE', 'setLocation', {
						nodeId: selectedNode.nodeId,
						value: $('#zwjs-node-edit-location').val()
					})
						.then((data) => {
							if (!data.callSuccess) {
								alert(data.response);
							} else {
								const ND = $('#zwjs-node-list')
									.treeList('data')
									.find((N) => N.nodeData.nodeId).nodeData;
								ND.nodeName = $('#zwjs-node-edit-name').val();
								ND.nodeLocation = $('#zwjs-node-edit-location').val();
								$(`#zwjs-node-name-${selectedNode.nodeId}`).text(ND.nodeName);

								nodeSelected(undefined, { nodeData: ND });

								alert('Name & Location Set Successfully!');
							}
						})
						.catch((Error) => {
							alert(Error.message);
						});
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	let AssociationGroups;
	const ResetAllAssociations = () => {
		if (
			confirm(
				'Are you sure you wish to wipe all Associations? this includes the LifeLine associations, you will need to re-create them after.'
			)
		) {
			Runtime.Post('CONTROLLER', 'getAllAssociations', [selectedNode.nodeId])
				.then((response) => {
					if (response.callSuccess) {
						response.response.forEach(function (E, i) {
							Object.keys(E.associations).forEach(async function (G, i) {
								if (E.associations[G].length > 0) {
									const Params = [];
									Params.push(E.associationAddress);
									Params.push(parseInt(G));
									Params.push(E.associations[G]);
									try {
										await Runtime.Post('CONTROLLER', 'removeAssociations', Params);
									} catch (Error) {
										alert(Error.message);
									}
								}
							});
						});
						alert('All associations successfully removed!');
						processAssociationGPSelect();
					} else {
						alert(response.response);
					}
				})
				.catch((Error) => {
					alert(Error.message);
				});
		}
	};

	const MarkAssoDelete = (El) => {
		$(El).closest('tr').attr('data-role', 'zwjs-remove-association');
		$(El).closest('tr').css({ textDecoration: 'line-through', color: 'silver' });
	};

	const CommitAssociations = () => {
		const Addresses = [];
		$("[data-role='zwjs-remove-association']").each(function (index) {
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
						CommitAssociationsAdd();
					} else {
						alert(response.response);
					}
				})
				.catch((Error) => {
					alert(Error.message);
				});
		} else {
			CommitAssociationsAdd();
		}
	};

	const CommitAssociationsAdd = () => {
		const Addresses = [];
		$("[data-role='zwjs-new-association']").each(function (index) {
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
						processAssociationGPSelect();
					} else {
						alert(response.response);
					}
				})
				.catch((Error) => {
					alert(Error.message);
				});
		} else {
			alert('Associations have been successfully updated!');
			processAssociationGPSelect();
		}
	};
	const PreppNewAssociation = () => {
		$('#zwjs-asso-mappings').append(
			'<tr data-role="zwjs-new-association"><td style="text-align:center"><input type="number" data-role="zwjs-node" value="1" min="1"></td><td style="text-align:center"><input type="number" data-role="zwjs-endpoint" min="0" placeholder="<Empty: Node-Association>"></td><td>&nbsp;</td></tr>'
		);
	};
	const processAssociationEPSelect = () => {
		const EP = $('#zwjs-asso-endpoints').val();
		const GPs = AssociationGroups[EP];

		$('#zwjs-asso-groups').empty();
		$('#zwjs-asso-groups').append(new Option('Select Association Group'));

		for (const [ID, GP] of Object.entries(GPs)) {
			$('#zwjs-asso-groups').append(new Option(`${GP.label} (Max: ${GP.maxNodes})`, ID));
		}
	};
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
			Mapped.forEach((v, i) => {
				$('#zwjs-asso-mappings').append(
					`<tr><td style="text-align:center">${v.nodeId}</td><td style="text-align:center">${v.endpoint === undefined ? '&lt;Node-Associtation&gt;' : v.endpoint}</td><td style="text-align:center"><i class="fa fa-trash" aria-hidden="true" style="font-size: 18px;color: red; cursor:pointer" onclick="ZWaveJS.MarkAssoDelete(this)"></i></td></tr>`
				);
			});
		});
	};

	const RenderFunctions = {
		ControllerInfo: () => {
			return new Promise(async (resolve, _) => {
				const CD = $('#zwjs-controller-info').data('info');
				const Response = {
					configuration: $('#zwjs-network option:selected').text(),
					serialPort: RED.nodes.node(networkId).serialPort,
					...CD
				};
				resolve(Response);
			});
		},
		ControllerStats: () => {
			return new Promise(async (resolve, _) => {
				const CD = $('#zwjs-controller-info').data('info');
				resolve(CD.statistics);
			});
		},
		NodeInfo: () => {
			return new Promise(async (resolve, _) => {
				const ND = $('#zwjs-node-list')
					.treeList('data')
					.find((N) => N.nodeData.nodeId === selectedNode.nodeId).nodeData;
				resolve(ND);
			});
		},
		NodeStats: () => {
			return new Promise(async (resolve, _) => {
				const ND = $('#zwjs-node-list')
					.treeList('data')
					.find((N) => N.nodeData.nodeId === selectedNode.nodeId).nodeData;
				resolve(ND.statistics);
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
							E.B64 = btoa(JSON.stringify(E));
						});
						resolve({ entries: R.response });
					} else {
						reject(R.response);
					}
				});
			});
		}
	};

	// Render Advanced
	const RenderAdvanced = async (TemplateID, Target, FunctionIDORObject) => {
		if (!AdvancedPanels.find((P) => P.id === TemplateID)) {
			const TPL = Handlebars.compile($(`#${TemplateID}`).html());
			AdvancedPanels.push({ id: TemplateID, compiled: TPL });
		}

		let Data = {};
		if (FunctionIDORObject && typeof FunctionIDORObject !== 'object') {
			try {
				Data = await RenderFunctions[FunctionIDORObject]();
			} catch (Response) {
				alert(Response);
				return;
			}
		} else if (FunctionIDORObject && typeof FunctionIDORObject === 'object') {
			Data = FunctionIDORObject;
		}

		const Output = AdvancedPanels.find((P) => P.id === TemplateID).compiled(Data);
		$('#zwjs-advanced-content').empty();
		$('#zwjs-advanced-content').append(Output);

		if (Target) {
			$('.zwjs-tray-menu div').removeAttr('active');
			$(Target).attr('active', '');
		}
	};

	const CloseTray = () => {
		// Kill Scanner
		if (QRS) {
			QRS.destroy();
			QRS = undefined;
		}

		// Kill any outstanding network task (we dont really need to await these)
		Runtime.Post('CONTROLLER', 'stopInclusion');
		Runtime.Post('CONTROLLER', 'stopExclusion');

		// Finally Close Tray
		RED.tray.close();
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
							var trayBody = tray.find('.red-ui-tray-body, .editor-tray-body');
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
					$('#zwjs-node-list')
						.treeList('data')
						.find((N) => N.nodeData.nodeId === RND.nodeId).nodeData = RND;

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
							var trayBody = tray.find('.red-ui-tray-body, .editor-tray-body');
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

	const RenderNodeIconState = (Node) => {
		$(`#zwjs-node-state-interview-${Node.nodeId}`).removeClass();
		$(`#zwjs-node-state-status-${Node.nodeId}`).removeClass();
		$(`#zwjs-node-state-power-${Node.nodeId}`).removeClass();

		if (Node.interviewStage !== 'Complete') {
			$(`#zwjs-node-state-interview-${Node.nodeId}`).addClass(['fa', 'fa-handshake-o', 'zwjs-state-amber']);
		} else {
			$(`#zwjs-node-state-interview-${Node.nodeId}`).addClass(['fa', 'fa-check', 'zwjs-state-green']);
		}

		switch (Node.status) {
			case 'Alive':
				$(`#zwjs-node-state-status-${Node.nodeId}`).addClass(['fa', 'fa-sun-o', 'zwjs-state-green']);
				break;
			case 'Asleep':
				$(`#zwjs-node-state-status-${Node.nodeId}`).addClass(['fa', 'fa-moon-o', 'zwjs-state-amber']);
				break;
			case 'Dead':
				$(`#zwjs-node-state-status-${Node.nodeId}`).addClass(['fa', 'fa-exclamation-triangle', 'zwjs-state-red']);
				break;
		}

		if (Node.powerSource.type === 'mains') {
			$(`#zwjs-node-state-power-${Node.nodeId}`).addClass(['fa', 'fa-plug']);
		}
	};

	const RefreshNodes = () => {
		if (!networkId) {
			return;
		}
		Runtime.Get('CONTROLLER', 'getNodes')
			.then((data) => {
				if (data.callSuccess) {
					data = data.response;

					const Controller = data.find((N) => N.isControllerNode);
					const Nodes = data.filter((N) => !N.isControllerNode);

					const Info = `${Controller.deviceConfig.manufacturer} | ${Controller.deviceConfig.label} | v${Controller.firmwareVersion}`;
					$('#zwjs-controller-info').text(Info);
					$('#zwjs-controller-info').data('info', Controller);

					// Render List
					const TreeData = [];
					Nodes.forEach((N) => {
						const Label = $('<div>');
						Label.append(`<span class="zwjs-node-id">${N.nodeId}</span>`);
						Label.append(`<span id="zwjs-node-name-${N.nodeId}">${N.nodeName || 'No Name'}</span>`);
						const IconSpan = $('<span>').addClass('zwjs-node-state-group');
						Label.append(IconSpan);

						IconSpan.append(`<i id="zwjs-node-state-interview-${N.nodeId}" aria-hidden="true"></i>`);
						IconSpan.append(`<i id="zwjs-node-state-status-${N.nodeId}" aria-hidden="true"></i>`);
						IconSpan.append(`<i id="zwjs-node-state-power-${N.nodeId}" aria-hidden="true"></i>`);

						RenderNodeIconState(N);

						TreeData.push({
							id: `zwjs-node-list-entry-${N.nodeId}`,
							element: Label,
							nodeData: N
							//icon: 'fa fa-circle'
						});
					});

					$('#zwjs-node-list').treeList('data', TreeData);

					TreeData.forEach((N) => {
						RenderNodeIconState(N.nodeData);
					});
				} else {
					alert(data.response);
				}
			})
			.catch((Error) => {
				alert(Error.message);
			});
	};

	// Network Selecetd
	const NetworkSelected = function () {
		// Remove Subscriptions
		if (networkId) {
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/status`, commsStatus);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/s2/grant`, commsGrant);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/s2/dsk`, commsDSK);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/added`, commsNodeAdded);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/removed`, commsNodeRemoved);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/interviewstarted`, commsNodeState);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/interviewfailed`, commsNodeState);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/interviewed`, commsNodeState);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/ready`, commsNodeState);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/sleep`, commsNodeState);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/awake`, commsNodeState);
			RED.comms.unsubscribe(`zwave-js/ui/${networkId}/nodes/dead`, commsNodeState);
			networkId = undefined;
		}

		if (!$('#zwjs-network').val()) {
			return;
		}

		networkId = $('#zwjs-network').val();

		// get Nodes ansd Info
		RefreshNodes();

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

		RED.comms.subscribe(`zwave-js/ui/${networkId}/status`, commsStatus);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/s2/grant`, commsGrant);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/s2/dsk`, commsDSK);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/added`, commsNodeAdded);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/removed`, commsNodeRemoved);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/interviewstarted`, commsNodeState);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/interviewfailed`, commsNodeState);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/interviewed`, commsNodeState);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/ready`, commsNodeState);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/sleep`, commsNodeState);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/awake`, commsNodeState);
		RED.comms.subscribe(`zwave-js/ui/${networkId}/nodes/dead`, commsNodeState);
	};

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
				children: []
			};

			CCGroups[CCID].forEach((V) => {
				const sItem = {
					label: V.metadata.label,
					icon: V.metadata.writeable ? 'fa fa-pencil' : '',
					metadata: V.metadata,
					valueId: V.valueId
				};

				Item.children.push(sItem);
			});

			Items.push(Item);
		});

		$('#zwjs-cc-list').treeList('data', Items);
	};

	// Node Selected
	const nodeSelected = (event, item) => {
		if (!item.nodeData) {
			return;
		}

		CloseTray();

		selectedNode = item.nodeData;

		$('#zwjs-endpoint-list').empty();
		$('#zwjs-cc-list').treeList('empty');
		$('#zwjs-node-status').text(selectedNode.status);
		$('#zwjs-node-info-id').text(selectedNode.nodeId);

		if (selectedNode.interviewStage !== 'Complete') {
			$('#zwjs-node-info').text(`Node Interview Stage : ${selectedNode.interviewStage}`);
			return;
		}

		const Info = `${selectedNode.deviceConfig.manufacturer} | ${selectedNode.deviceConfig.label} | v${selectedNode.firmwareVersion}`;
		$('#zwjs-node-info').text(Info);

		Runtime.Post('CONTROLLER', 'getValueDB', [selectedNode.nodeId])
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

					$('#zwjs-endpoint-list').empty();
					EPIDs.forEach((E) => {
						const EP = E === '0' ? 'Root' : `EP${E}`;
						const Button = $(`<div data-endpoint="${E}">${EP}</div>`);
						Button.click(() => {
							listCCs(EPGroups[E]);
							$('#zwjs-endpoint-list > div').removeAttr('selected');
							$(`#zwjs-endpoint-list > div[data-endpoint="${E}"]`).attr('selected', 'selected');
						});
						Button.data(EPGroups[E]);
						$('#zwjs-endpoint-list').append(Button);
					});

					$('#zwjs-endpoint-list > div[data-endpoint="0"]').attr('selected', '');
					listCCs(EPGroups['0']);
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
		// Templates
		TPL_SidePanel = Handlebars.compile($('#ZWJS_TPL_SidePanel').html());
		TPL_ControllerManagement = Handlebars.compile($('#ZWJS_TPL_Tray-Controller').html());
		TPL_NodeManagement = Handlebars.compile($('#ZWJS_TPL_Tray-Node').html());

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

		setTimeout(() => {
			RED.nodes.eachConfig((c) => {
				if (c.type === 'zwavejs-runtime') {
					$('#zwjs-network').append(new Option(c.name, c.id));
				}
			});

			if ($('#zwjs-network option').length === 2) {
				const Value = $('#zwjs-network option:eq(1)').attr('value');
				$('#zwjs-network').val(Value);
				NetworkSelected();
			}
			RED.actions.add('zwjs:show-recent-interviewed-node', function () {
				RED.sidebar.show('zwave-js');
				nodeSelected(undefined, lastInterviewedNode);
			});
		}, 1000);
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
		MarkAssoDelete
	};
})();
