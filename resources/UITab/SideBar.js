/* eslint no-undef: "warn"*/
// eslint-disable-next-line no-unused-vars
const ZWaveJS = (function () {
	/*
	 * MODULE STATE
	 */
	const AdvancedPanels = [];
	const SetValueOptionExamples = {
		transitionDuration: '30s, 1m, 1m10s',
		volume: 45
	};
	const GroupMode = [true, true];
	let networkId = undefined;
	let selectedNode = undefined;
	let QRS;
	let TPL_SidePanel = undefined;
	let TPL_ControllerManagement = undefined;
	let TPL_ControllerManagementRecover = undefined;
	let TPL_NodeManagement = undefined;
	let TPL_ValueManagement = undefined;
	let AssociationGroups;
	let clientSideAuth = false;
	let SelectedNodeVIDs = {};
	let MiniEdtiorDialog;
	let ViewingValueID = undefined;
	let BootLoaderMode = false;
	let CodeEditor = undefined;
	let Panels = undefined;
	let isCurrentTray = false;

	/*
	 * RUNTIME TRANSPORT
	 */

	const requestRuntime = (type, API, Method, Data, URL) =>
		new Promise((resolve, reject) => {
			const options = {
				type,
				timeout: 0,
				url: URL || `zwave-js/ui/${networkId}/${API}/${Method}`,
				success: resolve,
				error: (jqXHR, textStatus, errorThrown) => reject(new Error(`${textStatus}: ${errorThrown}`)),
				dataType: 'json'
			};

			if (type === 'POST') {
				options.data = JSON.stringify(Data);
				options.contentType = 'application/json';
			}

			$.ajax(options);
		});

	const Runtime = {
		Get: (API, Method, URL) => requestRuntime('GET', API, Method, undefined, URL),
		Post: (API, Method, Data, URL) => requestRuntime('POST', API, Method, Data, URL)
	};

	const downloadBlob = (blob, fileName) => {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		link.style.display = 'none';
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 0);
	};

	const selectFile = (onSelected) =>
		new Promise((resolve, reject) => {
			const fileInput = document.createElement('input');
			fileInput.type = 'file';
			fileInput.style.display = 'none';
			document.body.appendChild(fileInput);

			let settled = false;
			const cleanup = () => fileInput.remove();
			const finish = (callback, value) => {
				if (settled) return;
				settled = true;
				cleanup();
				callback(value);
			};

			fileInput.addEventListener(
				'change',
				async () => {
					const file = fileInput.files?.[0];
					if (!file) return finish(resolve, false);
					try {
						await onSelected(file);
						finish(resolve, true);
					} catch (error) {
						finish(reject, error);
					}
				},
				{ once: true }
			);

			window.addEventListener(
				'focus',
				() => {
					setTimeout(() => {
						if (!settled && !fileInput.files?.length) finish(resolve, false);
					}, 0);
				},
				{ once: true }
			);

			fileInput.click();
		});

	const readFileAsUint8Array = (file) =>
		new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (event) => resolve(new Uint8Array(event.target.result));
			reader.onerror = () => reject(reader.error || new Error('Unable to read the selected file'));
			reader.readAsArrayBuffer(file);
		});

	const toError = (error, fallback = 'Unknown Z-Wave JS error') => {
		if (error instanceof Error) return error;
		if (typeof error === 'string' && error) return new Error(error);
		try {
			return new Error(error == null ? fallback : JSON.stringify(error));
		} catch {
			return new Error(fallback);
		}
	};

	const requireSuccessfulCall = (result) => {
		if (!result || result.callSuccess !== true) {
			throw toError(result?.response, 'The Z-Wave JS runtime call failed');
		}
		return result.response;
	};

	const requireSelectedNode = () => {
		if (!selectedNode) throw new Error('No Z-Wave node is currently selected');
		return selectedNode;
	};

	const getSelectedNodeData = () => {
		const currentNode = requireSelectedNode();
		const group = GetNodeGroup(currentNode.nodeLocation);
		const treeNode = group?.children?.find((node) => node.nodeData?.nodeId === currentNode.nodeId);
		if (!treeNode?.nodeData) throw new Error(`Node ${currentNode.nodeId} is no longer present in the sidebar`);
		return treeNode.nodeData;
	};

	const showManagementTray = (title, template, state) => {
		RED.tray.show({
			width: 900,
			title,
			buttons: [
				{
					id: 'zwjs-tray-close',
					text: 'Close',
					click: CloseTray
				}
			],
			open: (tray) => {
				isCurrentTray = true;
				tray.find('.red-ui-tray-body, .editor-tray-body').append(template(state));
			}
		});

		setTimeout(() => {
			const defaultMenuItem = $('.zwjs-tray-menu > div[default]')[0];
			if (defaultMenuItem?.onclick) defaultMenuItem.onclick.call(defaultMenuItem);
		}, 250);
	};

	/*
	 * INITIALISATION
	 */

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

		Handlebars.registerHelper('editor', function (id, context) {
			setTimeout(() => {
				CodeEditor = RED.editor.createEditor({
					id: id,
					mode: 'ace/mode/json',
					value: context.fn(this)
				});
			}, 175);
			return new Handlebars.SafeString(
				`<div style="height: 250px; min-height:150px;" class="node-text-editor" id="${id}"></div>`
			);
		});

		TPL_SidePanel = Handlebars.compile($('#ZWJS_TPL_SidePanel').html());
		TPL_ControllerManagement = Handlebars.compile($('#ZWJS_TPL_Tray-Controller').html());
		TPL_ControllerManagementRecover = Handlebars.compile($('#ZWJS_TPL_Tray-Controller-Recover').html());
		TPL_NodeManagement = Handlebars.compile($('#ZWJS_TPL_Tray-Node').html());
		TPL_ValueManagement = Handlebars.compile($('#ZWJS_TPL_Tray-Node-Value').html());

		RED.sidebar.addTab({
			id: 'zwave-js',
			label: ' ZWave JS',
			name: 'Z-Wave JS',
			content: TPL_SidePanel({}),
			enableOnEdit: true,
			iconClass: 'fa fa-wifi',
			onchange: () => setTimeout(resizeStack, 0)
		});

		$('#zwjs-node-list').treeList({ data: [] });
		$('#zwjs-node-list').on('treelistselect', nodeSelected);
		$('#zwjs-cc-list').treeList({ data: [] });

		Panels = RED.panels.create({ container: $('#zwjs-panel-stack') });
		Panels.ratio(0.3);

		const resizeStack = () => Panels.resize($('#zwjs-sidebar').height());
		RED.events.on('sidebar:resize', resizeStack);
		$(window).on('resize', resizeStack);
		$(window).on('focus', resizeStack);

		commsListOrAddNetworks(true);

		RED.comms.subscribe('zwave-js/ui/global/addnetwork', (topic, network) => commsListOrAddNetworks(false, network));
		RED.comms.subscribe('zwave-js/ui/global/removenetwork', (topic, network) => commsRemoveNetwork(network));

		$('#zwjs-sidebar a[data-tip]').each(function () {
			RED.popover.tooltip($(this), $(this).data('tip'));
		});
	};

	/*
	 * COMMON UI
	 */

	const ZWJSAlert = (msg) => {
		$('<div>')
			.text(msg)
			.dialog({
				modal: true,
				title: 'Alert',
				buttons: {
					OK: function () {
						$(this).dialog('close');
					}
				},
				close: function () {
					$(this).dialog('destroy').remove();
				}
			});
	};

	const ZWJSConfirm = (message) => {
		return new Promise((resolve) => {
			let answered = false;

			$('<div>', {
				text: message
			}).dialog({
				modal: true,
				title: 'Confirm',

				buttons: {
					OK: function () {
						answered = true;
						resolve(true);
						$(this).dialog('close');
					},

					Cancel: function () {
						answered = true;
						resolve(false);
						$(this).dialog('close');
					}
				},

				close: function () {
					if (!answered) {
						resolve(false);
					}

					$(this).dialog('destroy').remove();
				}
			});
		});
	};

	const DisableButton = (Button) => {
		$(Button).data('original_text', $(Button).text());
		$(Button).text('Please wait...');
		$(Button).prop('disabled', true);
	};

	const EnableButton = (Button) => {
		$(Button).text($(Button).data('original_text'));
		$(Button).prop('disabled', false);
	};

	const runButtonAction = async (button, action) => {
		DisableButton(button);
		try {
			return await action();
		} catch (error) {
			ZWJSAlert(toError(error).message);
			return undefined;
		} finally {
			EnableButton(button);
		}
	};

	const ZoomUI = (value) => {
		const sidebar = $('#zwjs-sidebar');
		if (value === undefined) {
			sidebar.css('zoom', '1.0');
			Panels.resize($('#zwjs-sidebar').height());
			return;
		}

		let current = parseFloat(sidebar.css('zoom'));
		if (isNaN(current)) current = 1;
		let newZoom = current + value;
		newZoom = Math.min(Math.max(newZoom, 0.1), 2.0);
		newZoom = parseFloat(newZoom.toFixed(2));
		sidebar.css('zoom', newZoom);

		Panels.resize($('#zwjs-sidebar').height());
	};

	const CloseTray = () => {
		if (isCurrentTray) {
			if (QRS) {
				QRS.destroy();
				QRS = undefined;
			}

			Runtime.Get('CONTROLLER', 'stopInclusion');
			Runtime.Get('CONTROLLER', 'stopExclusion');
			Runtime.Get('CONTROLLER', 'stopJoiningNetwork');
			Runtime.Get('CONTROLLER', 'stopLeavingNetwork');

			if (CodeEditor) {
				CodeEditor.destroy();
				CodeEditor = undefined;
			}

			RED.tray.close();
			isCurrentTray = false;
		}
	};

	const DecodeObject = (Item) => {
		const decoded = new TextDecoder().decode(Uint8Array.from(atob(Item), (c) => c.charCodeAt(0)));
		return JSON.parse(decoded);
	};

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

	const formatDateTime = (ts) => {
		const d = new Date(ts);
		if (Number.isNaN(d.getTime())) return 'Not Available';

		const parts = new Intl.DateTimeFormat(navigator.language || 'en-GB', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		}).formatToParts(d);

		const map = {};
		parts.forEach((p) => {
			if (p.type !== 'literal') map[p.type] = p.value;
		});

		const dateOrder = parts
			.filter((p) => ['day', 'month', 'year'].includes(p.type))
			.map((p) => map[p.type])
			.join('.');

		const time = `${map.hour}:${map.minute}:${map.second}`;
		return `${dateOrder} ${time}`;
	};

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

	/*
	 * NETWORK SELECTION
	 */

	const waitForNetworkStatus = async (targetNetworkId) => {
		while (networkId === targetNetworkId) {
			const result = await Runtime.Get(undefined, undefined, `zwave-js/ui/${targetNetworkId}/status`);
			if (result?.response !== undefined) return result.response;
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
		return undefined;
	};

	const applyNetworkStatus = (status) => {
		$('#zwjs-controller-status').text(status);
		if (status === 'Bootloader ready.') {
			handleBootloader();
			return;
		}
		BootLoaderMode = false;
		RefreshNodes('NetworkSelected');
	};

	const NetworkSelected = async () => {
		const previousNetworkId = networkId;
		if (previousNetworkId) setSubscription(false, previousNetworkId);
		const selectedNetwork = $('#zwjs-network').val();
		ClearSelection(true);
		if (selectedNetwork === 'NONE') {
			networkId = undefined;
			return;
		}

		$('#zwjs-controller-info').text('--');
		$('#zwjs-controller-status').text('Waiting for Network Status Report...');
		networkId = selectedNetwork;
		setSubscription(true);

		try {
			const status = await waitForNetworkStatus(selectedNetwork);
			if (networkId === selectedNetwork && status !== undefined) applyNetworkStatus(status);
		} catch (error) {
			ZWJSAlert(error.message || error);
		}
	};

	const SelectFirstNetwork = () => {
		const select = $('#zwjs-network');
		const options = select.children();
		const count = options.length;

		if (count === 2) {
			select.val(options.eq(1).val());
			NetworkSelected();
		}

		select.parent().toggle(count >= 3);
	};

	const ShowRecovery = () => {
		showManagementTray('ZWave JS Controller Management (Recovery)', TPL_ControllerManagementRecover, {
			Network: $('#zwjs-controller-info').text(),
			Status: $('#zwjs-controller-status').text()
		});
	};

	/*
	 * NODE LIST
	 */

	const shouldResetNodeContext = (reason) =>
		['Refresh', 'NetworkJoin', 'NetworkLeft', 'NetworkSelected', 'DriverReady'].includes(reason);

	const prepareNodeContextForRefresh = (reason, nodeId) => {
		if (shouldResetNodeContext(reason)) {
			ClearSelection();
			CloseTray();
			return;
		}

		if (reason === 'NodeRemoved' && selectedNode?.nodeId === nodeId) {
			ClearSelection();
		}
	};

	const getLocationInitials = (location) =>
		(location || '')
			.split(/\s+/)
			.map((word) => word[0] || '')
			.join('')
			.toUpperCase();

	const groupNodesByLocation = (nodes) =>
		nodes.reduce((groups, node) => {
			const location = GroupMode[0] ? node.nodeLocation || 'No Location' : 'All Nodes';
			(groups[location] ||= []).push(node);
			return groups;
		}, {});

	const createNodeGroupLabel = (location) => {
		const label = $(
			`<div zwjs-node-group><span class="zwjs-node-id">${getLocationInitials(location)}</span> <i aria-hidden="true" class="zwjs-group-status fa fa-exclamation-triangle zwjs-state-amber" style="display:none"></i> ${location} </div>`
		);
		const stateIcons = $('<span group>').addClass('zwjs-node-state-group');
		stateIcons.append('<i aria-hidden="true">Int</i>');
		stateIcons.append('<i aria-hidden="true">Sta</i>');
		stateIcons.append('<i aria-hidden="true">Pow</i>');
		stateIcons.append('<i aria-hidden="true">Sec</i>');
		label.append(stateIcons);
		return label;
	};

	const createNodeTreeItem = (node) => {
		const label = $('<div>');
		label.append(`<span class="zwjs-node-id">${node.nodeId}</span>`);
		label.append(`<span id="zwjs-node-name-${node.nodeId}">${node.nodeName || 'No Name'}</span>`);

		const stateIcons = $('<span>').addClass('zwjs-node-state-group');
		stateIcons.append(`<i id="zwjs-node-state-interview-${node.nodeId}" aria-hidden="true"></i>`);
		stateIcons.append(`<i id="zwjs-node-state-status-${node.nodeId}" aria-hidden="true"></i>`);
		stateIcons.append(`<i id="zwjs-node-state-power-${node.nodeId}" aria-hidden="true"></i>`);
		stateIcons.append(`<i id="zwjs-node-state-security-${node.nodeId}" aria-hidden="true"></i>`);
		label.append(stateIcons);

		return { id: `zwjs-node-list-entry-${node.nodeId}`, element: label, nodeData: node };
	};

	const buildNodeTree = (nodes) =>
		Object.entries(groupNodesByLocation(nodes)).map(([location, locationNodes]) => ({
			id: `zwjs-node-list-entry-location-${location.replace(/ /g, '-')}`,
			element: createNodeGroupLabel(location),
			children: locationNodes.map(createNodeTreeItem),
			expanded: (GroupMode[0] && GroupMode[1]) || !GroupMode[0]
		}));

	const updateControllerSummary = (controller) => {
		const manufacturer = controller.deviceConfig.manufacturer;
		const label = controller.deviceConfig.label;
		$('#zwjs-controller-info').text(`${manufacturer} | ${label} | v${controller.firmwareVersion}`);
		$('#zwjs-controller-info').data('info', controller);
	};

	const renderNodeTree = (nodes) => {
		const treeData = buildNodeTree(nodes);
		$('#zwjs-node-list').treeList('data', treeData);
		treeData.forEach((group) => group.children.forEach((item) => RenderNodeIconState(item.nodeData)));
	};

	const splitControllerFromNodes = (allNodes) => ({
		controller: allNodes.find((node) => node.isControllerNode),
		nodes: allNodes.filter(
			(node) => !node.isControllerNode && (node.zwavePlusRoleType > 3 || node.zwavePlusRoleType === undefined)
		)
	});

	const RefreshNodes = async (reason, nodeId) => {
		if (!networkId) return;

		prepareNodeContextForRefresh(reason, nodeId);

		try {
			const allNodes = requireSuccessfulCall(await Runtime.Get('CONTROLLER', 'getNodes'));
			const { controller, nodes } = splitControllerFromNodes(allNodes);
			updateControllerSummary(controller);
			renderNodeTree(nodes);
		} catch (error) {
			ZWJSAlert(error.message || error);
		} finally {
			RenderGroupIconState();
		}
	};

	const NodeCollapseToggle = (Mode, A) => {
		$('i.zwjs-button-group').removeAttr('selected');
		$(A).find('i.zwjs-button-group').attr('selected', '');

		switch (Mode) {
			case 1:
				GroupMode[0] = true;
				GroupMode[1] = true;
				RefreshNodes('Sorted');
				break;
			case 2:
				GroupMode[0] = true;
				GroupMode[1] = false;
				RefreshNodes('Sorted');
				break;
			case 3:
				GroupMode[0] = false;
				GroupMode[1] = true;
				RefreshNodes('Sorted');
				break;
		}
	};

	const GetNodeGroup = (Group) => {
		let safeGroup;
		if (!GroupMode[0]) {
			safeGroup = 'All Nodes';
		} else {
			safeGroup = Group && Group.trim() !== '' ? Group : 'No Location';
		}

		const G = `zwjs-node-list-entry-location-${safeGroup.replace(/ /g, '-')}`;
		return $('#zwjs-node-list')
			.treeList('data')
			.find((N) => N.id === G);
	};

	const RenderGroupIconState = () => {
		setTimeout(() => {
			const Data = $('#zwjs-node-list').treeList('data');

			for (let i = 0; i < Data.length; i++) {
				const group = Data[i];
				if (!group.children) continue;

				const GroupStatusElement = $(group.element).find('i.zwjs-group-status');
				let GroupStatus = 0;

				for (let j = 0; j < group.children.length; j++) {
					const device = group.children[j];
					if (!device.element) continue;

					const el = $(device.element);
					const allIcons = el.find(
						'span.zwjs-node-state-group i[id^="zwjs-node-state-status"], span.zwjs-node-state-group i[id^="zwjs-node-state-power"]'
					);
					for (let k = 0; k < allIcons.length; k++) {
						const classes = allIcons[k].className;
						if (classes.includes('zwjs-state-red')) {
							GroupStatus = 2;
							break;
						}
						if (classes.includes('zwjs-state-amber') && GroupStatus < 2) {
							GroupStatus = 1;
						}
					}
					if (GroupStatus === 2) break;
				}

				GroupStatusElement.hide().removeClass('zwjs-state-amber zwjs-state-red');

				switch (GroupStatus) {
					case 1:
						GroupStatusElement.show().addClass('zwjs-state-amber');
						break;

					case 2:
						GroupStatusElement.show().addClass('zwjs-state-red');
						break;
				}
			}
		}, 150);
	};

	/*
	 * NODE SELECTION
	 */

	const resetNodeStateIcons = (icons) => Object.values(icons).forEach((icon) => icon.removeClass());

	const renderInterviewIcon = (node, icon) => {
		const complete = node.interviewStage === 'Complete';
		icon.addClass(['fa', complete ? 'fa-check' : 'fa-handshake-o', complete ? 'zwjs-state-green' : 'zwjs-state-amber']);
		RED.popover.tooltip(icon, complete ? 'Fully Interviewed' : 'Pending Interview');
	};

	const renderAvailabilityIcon = (node, icon) => {
		const lastSeen = node.lastSeen === undefined ? '' : `${formatDateTime(node.lastSeen)} : `;
		const stale =
			node.status !== 'Dead' &&
			node.status !== 'Unknown' &&
			node.lastSeen !== undefined &&
			Date.now() - node.lastSeen > 7 * 24 * 60 * 60 * 1000;
		if (stale) {
			icon.addClass(['fa', 'fa-question-circle', 'zwjs-state-amber']);
			RED.popover.tooltip(icon, `${formatDateTime(node.lastSeen)} : Seen +7 days ago`);
			return;
		}

		const states = {
			Alive: ['fa-sun-o', 'zwjs-state-green', 'Alive/Awake'],
			Awake: ['fa-sun-o', 'zwjs-state-green', 'Alive/Awake'],
			Asleep: ['fa-moon-o', 'zwjs-state-darkgray', 'Alseep'],
			Dead: ['fa-exclamation-triangle', 'zwjs-state-red', 'Dead/Not Responding'],
			Unknown: ['fa-question-circle', 'zwjs-state-amber', 'Unknown']
		};
		const state = states[node.status];
		if (!state) return;
		icon.addClass(['fa', state[0], state[1]]);
		RED.popover.tooltip(icon, `${lastSeen}${state[2]}`);
	};

	const renderPowerIcon = (node, icon) => {
		if (node.powerSource.type === 'mains') {
			icon.addClass(['fa', 'fa-plug', 'zwjs-state-green']);
			RED.popover.tooltip(icon, 'Mains Powered');
			return;
		}

		const level = node.powerSource.level;
		const batteryIcon =
			level <= 10
				? 'fa-battery-empty'
				: level <= 25
					? 'fa-battery-quarter'
					: level <= 75
						? 'fa-battery-half'
						: level <= 85
							? 'fa-battery-three-quarters'
							: 'fa-battery-full';
		icon.addClass(['fa', batteryIcon]);
		RED.popover.tooltip(icon, `Battery Powered: (${level}%)`);

		const replacementState = node.powerSource.rechargeOrReplace;
		const colour =
			replacementState === 1
				? 'zwjs-state-amber'
				: replacementState === 2
					? 'zwjs-state-red'
					: replacementState !== undefined
						? 'zwjs-state-green'
						: level <= 10
							? 'zwjs-state-red'
							: level <= 25
								? 'zwjs-state-amber'
								: 'zwjs-state-green';
		icon.addClass(colour);
	};

	const getSecurityClassLabel = (securityClass) =>
		({
			0: 'S2 | Unauthenticated',
			1: 'S2 | Authenticated',
			2: 'S2 | Access Control',
			7: 'S0 | Legacy'
		})[securityClass] || 'No Security';

	const renderSecurityIcon = (node, icon) => {
		const securityClass = node.highestSecurityClass;
		const isS2 = [0, 1, 2].includes(securityClass);
		const isS0 = securityClass === 7;
		icon.addClass([
			'fa',
			isS2 || isS0 ? 'fa-lock' : 'fa-unlock-alt',
			isS2 ? 'zwjs-state-green' : isS0 ? 'zwjs-state-darkblue' : 'zwjs-state-darkgray'
		]);
		RED.popover.tooltip(icon, getSecurityClassLabel(securityClass));
	};

	const RenderNodeIconState = (node) => {
		const icons = {
			interview: $(`#zwjs-node-state-interview-${node.nodeId}`),
			status: $(`#zwjs-node-state-status-${node.nodeId}`),
			power: $(`#zwjs-node-state-power-${node.nodeId}`),
			security: $(`#zwjs-node-state-security-${node.nodeId}`)
		};
		resetNodeStateIcons(icons);
		renderInterviewIcon(node, icons.interview);
		renderAvailabilityIcon(node, icons.status);
		renderPowerIcon(node, icons.power);
		renderSecurityIcon(node, icons.security);
	};

	const SClassMap = {
		0: 'S2 Unauthenticated',
		1: 'S2 Authenticated',
		2: 'S2 AccessControl',
		7: 'S0 Legacy'
	};

	const groupValuesByEndpoint = (values) =>
		values.reduce((groups, value) => {
			const endpoint = value.valueId.endpoint;
			(groups[endpoint] = groups[endpoint] || []).push(value);
			return groups;
		}, {});

	const resizeForEndpointCount = (endpointCount) => {
		const hasMultipleEndpoints = endpointCount >= 2;
		$('#zwjs-endpoint-list').toggle(hasMultipleEndpoints);
		$('#zwjs-cc-list').css({ height: hasMultipleEndpoints ? 'calc(100% - 200px)' : 'calc(100% - 165px)' });
		Panels.resize($('#zwjs-sidebar').height());
	};

	const selectEndpoint = (endpoint, endpointGroups) => {
		listCCs(endpointGroups[endpoint]);
		$('#zwjs-endpoint-list > div').removeAttr('selected');
		$(`#zwjs-endpoint-list > div[data-endpoint="${endpoint}"]`).attr('selected', 'selected');
	};

	const renderEndpointButtons = (endpointGroups) => {
		const endpointIds = Object.keys(endpointGroups);
		resizeForEndpointCount(endpointIds.length);

		if (!endpointIds.length) return;

		endpointIds.forEach((endpoint) => {
			const label = endpoint === '0' ? 'Root' : `EP${endpoint}`;
			$(`<div data-endpoint="${endpoint}">${label}</div>`)
				.on('click', () => selectEndpoint(endpoint, endpointGroups))
				.appendTo('#zwjs-endpoint-list');
		});

		selectEndpoint('0', endpointGroups);
	};

	const ensureDeviceConfig = (node) => {
		node.deviceConfig ||= {};
		node.deviceConfig.manufacturer ??= 'NO CONFIG';
		node.deviceConfig.label ??= 'FOUND IN DB';
		return node;
	};

	const renderSelectedNodeSummary = (node) => {
		$('#zwjs-node-status').text(node.status);
		$('#zwjs-node-info-id').text(node.nodeId);
		if (node.interviewStage !== 'Complete') {
			$('#zwjs-node-info').text(`Node Interview Stage : ${node.interviewStage}`);
			return;
		}
		$('#zwjs-node-info').text(
			`${node.deviceConfig.manufacturer} | ${node.deviceConfig.label} | v${node.firmwareVersion}`
		);
	};

	const loadSelectedNodeValues = async (node) => {
		const result = await Runtime.Post('DRIVER', 'getValueDB', [node.nodeId]);
		return requireSuccessfulCall(result)[0].values || [];
	};

	const nodeSelected = async (event, item) => {
		if (!item.nodeData) return;

		selectedNode = ensureDeviceConfig(item.nodeData);
		SelectedNodeVIDs = {};
		$('#zwjs-endpoint-list').empty();
		$('#zwjs-cc-list').treeList('empty');
		CloseTray();
		renderSelectedNodeSummary(selectedNode);

		try {
			const values = await loadSelectedNodeValues(selectedNode);
			renderEndpointButtons(groupValuesByEndpoint(values));
		} catch (error) {
			ZWJSAlert(error.message || error);
		}
	};

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

	/*
	 * COMMAND CLASSES AND VALUES
	 */

	const getValueUpdateHash = (Obj) => {
		Obj = JSON.stringify(Obj);
		Obj = `${selectedNode.nodeId}${Obj}`;
		let hash = 5381;
		for (let i = 0; i < Obj.length; i++) {
			hash = (hash << 5) + hash + Obj.charCodeAt(i);
		}
		return (hash >>> 0).toString(16);
	};

	const formatHex = (value, width = 2) => `0x${parseInt(value).toString(16).padStart(width, '0').toUpperCase()}`;

	const formatCurrentValue = (valueInfo) => {
		const value = valueInfo.currentValue;
		if (value === undefined) return '';

		let displayValue = value;
		if (typeof value === 'object' && !Array.isArray(value)) {
			displayValue = '(Complex)';
		} else if (valueInfo.metadata?.states?.[value]) {
			displayValue = valueInfo.metadata.states[value];
		} else if (valueInfo.metadata?.unit) {
			displayValue = `${value} (${valueInfo.metadata.unit})`;
		}

		return `<span class="zwjs-cc-value" id="zwjs-value-${getValueUpdateHash(valueInfo.valueId)}">${displayValue}</span>`;
	};

	const formatValueProperty = (valueId) => {
		const formatPart = (part) => (typeof part === 'number' ? formatHex(part) : part);
		let property = formatPart(valueId.property);
		if (valueId.propertyKey !== undefined && valueId.propertyKey !== null) {
			property += ` / ${formatPart(valueId.propertyKey)}`;
		}
		return property;
	};

	const sanitiseExampleValueId = (valueId) => {
		const cleanValueId = { ...valueId };
		delete cleanValueId.commandClassName;
		delete cleanValueId.propertyName;
		delete cleanValueId.propertyKeyName;
		return cleanValueId;
	};

	const buildValueExamples = (valueInfo) => {
		const cleanValueId = sanitiseExampleValueId(valueInfo.valueId);
		const examples = {
			valueLabel: valueInfo.metadata.label,
			nocmd: {
				payload: {
					cmd: { api: 'VALUE', method: valueInfo.metadata.writeable ? 'setValue | getValue' : 'getValue' },
					cmdProperties: { nodeId: selectedNode.nodeId, valueId: { ...cleanValueId } }
				}
			},
			cmd: { topic: selectedNode.nodeId, valueId: { ...cleanValueId } }
		};

		if (valueInfo.metadata.writeable) {
			examples.nocmd.payload.cmdProperties.value = valueInfo.currentValue;
			examples.cmd.payload = valueInfo.currentValue;
		}

		if (valueInfo.metadata.valueChangeOptions) {
			examples.cmd.options = {};
			examples.nocmd.payload.cmdProperties.setValueOptions = {};
			valueInfo.metadata.valueChangeOptions.forEach((option) => {
				examples.cmd.options[option] = SetValueOptionExamples[option];
				examples.nocmd.payload.cmdProperties.setValueOptions[option] = SetValueOptionExamples[option];
			});
		}
		return examples;
	};

	const buildValueManagementState = (valueInfo) => ({
		ccId: formatHex(valueInfo.valueId.commandClass),
		ccName: valueInfo.valueId.commandClassName,
		valueLabel: valueInfo.metadata.label,
		nodeId: selectedNode.nodeId,
		property: formatValueProperty(valueInfo.valueId),
		editInfo: {
			valueLabel: valueInfo.metadata.label,
			valueId: valueInfo.valueId,
			writeable: valueInfo.metadata.writeable,
			currentValue: valueInfo.currentValue,
			type: valueInfo.metadata.type,
			states: valueInfo.metadata.states,
			allowManualEntry: valueInfo.metadata.allowManualEntry ?? valueInfo.metadata.writeable
		},
		examples: buildValueExamples(valueInfo),
		debug: { currentValue: valueInfo.currentValue, valueId: valueInfo.valueId, metadata: valueInfo.metadata }
	});

	const showMiniValueEditor = (state, useMobileWidth) => {
		const dialog = $('<div>').css({ padding: 10, wordWrap: 'break-word' });
		dialog.append('<div id="zwjs-mini-content"></div>');
		MiniEdtiorDialog = dialog.dialog({
			draggable: false,
			modal: true,
			resizable: false,
			width: useMobileWidth ? '90%' : '20%',
			position: { my: 'center', at: 'center', of: window },
			title: 'Mini Value Editor',
			minHeight: 160,
			buttons: {},
			close() {
				document.activeElement.blur();
				$(this).dialog('destroy');
				MiniEdtiorDialog = undefined;
			},
			open() {
				CloseTray();
				ZWaveJS.RenderAdvanced('ZWJS_TPL_Tray-Node-Value-Current', undefined, state.editInfo, '#zwjs-mini-content');
			}
		});
	};

	const showValueManagementTray = (state) => {
		CloseTray();
		RED.tray.show({
			width: 700,
			title: 'Value Management',
			buttons: [{ id: 'zwjs-tray-close', text: 'Close', click: CloseTray }],
			open(tray) {
				isCurrentTray = true;
				tray.find('.red-ui-tray-body, .editor-tray-body').append(TPL_ValueManagement(state));
				setTimeout(() => {
					const defaultMenuItem = $('.zwjs-tray-menu > div[default]')[0];
					defaultMenuItem.onclick.call(defaultMenuItem);
				}, 250);
			}
		});
	};

	const openValueManagement = (event, valueInfo) => {
		ViewingValueID = valueInfo.valueId;
		const state = buildValueManagementState(valueInfo);
		const useMobileWidth = $(window).width() < 1024;
		const clickedCurrentValue = $(event.originalEvent?.target).closest('.zwjs-cc-value').length > 0;

		if (useMobileWidth || clickedCurrentValue) {
			showMiniValueEditor(state, useMobileWidth);
			return;
		}
		showValueManagementTray(state);
	};

	const buildCommandClassTree = (collection) => {
		const groups = collection.reduce((byCommandClass, value) => {
			(byCommandClass[value.valueId.commandClass] ||= []).push(value);
			return byCommandClass;
		}, {});

		return Object.entries(groups).map(([commandClassId, values]) => ({
			element: `<div><span class="zwjs-cc-id">${formatHex(commandClassId)}</span> - ${values[0].valueId.commandClassName}</div>`,
			parent: true,
			children: values.map((value) => {
				const hash = getValueUpdateHash(value.valueId);
				SelectedNodeVIDs[hash] = { metadata: value.metadata, valueId: value.valueId, currentValue: value.currentValue };
				return {
					element: `<div style="width:100%; margin-right:30px">${value.metadata.label || value.valueId.property} ${formatCurrentValue(value)}</div>`,
					icon: value.metadata.writeable ? 'fa fa-pencil' : '',
					parent: false,
					valueInfo: SelectedNodeVIDs[hash]
				};
			})
		}));
	};

	const listCCs = (collection) => {
		const commandClassTree = buildCommandClassTree(collection);
		const tree = $('#zwjs-cc-list');
		tree.treeList('empty');
		tree.treeList('data', commandClassTree);
		tree.off('treelistselect');
		tree.on('treelistselect', (event, item) => {
			if (!item || Object.keys(item).length < 1 || item.parent === true) return;
			openValueManagement(event, item.valueInfo);
		});
	};

	const readEditedValue = (definedValue) => {
		if (CodeEditor) return JSON.parse(CodeEditor.getValue());

		const editor = $('#zwjs-cc-value-new');
		if (definedValue) {
			const value = parseInt($('#zwjs-cc-value-new-defined').val());
			editor.val(value);
			return value;
		}

		if (editor.is('select')) return parseInt(editor.val());
		if (!editor.is('input')) return undefined;

		switch (editor.attr('type')) {
			case 'number':
				return parseInt(editor.val());
			case 'checkbox':
				return editor.prop('checked');
			case 'color':
				return editor.val().substring(1);
			default:
				return undefined;
		}
	};

	const describeSetValueFailure = (status) =>
		({
			0: 'The Node does not support the command',
			1: 'The Node is working on the requested change',
			2: 'The Node rejected the change',
			3: 'The target Endpoint was not found on the Node',
			4: 'The set command has not been implemented for this CC',
			5: 'The provided value was not valid'
		})[status];

	const showValueUpdateSuccess = (button) => {
		$(button).css({ backgroundColor: 'green' });
		setTimeout(() => $(button).css({ backgroundColor: '' }), 1500);

		if (MiniEdtiorDialog) {
			MiniEdtiorDialog.dialog('destroy');
			MiniEdtiorDialog = undefined;
		}
	};

	const UpdateValue = async (button, encodedValueId, definedValue) => {
		DisableButton(button);
		try {
			const valueId = DecodeObject(encodedValueId);
			const value = readEditedValue(definedValue);
			const result = await Runtime.Post('VALUE', 'setValue', { nodeId: selectedNode.nodeId, valueId, value });

			if (!result.callSuccess) {
				ZWJSAlert(result.response);
				return;
			}

			const failure = describeSetValueFailure(result.response.status);
			failure ? ZWJSAlert(failure) : showValueUpdateSuccess(button);
		} catch (error) {
			ZWJSAlert(error.message || error);
		} finally {
			EnableButton(button);
		}
	};

	/*
	 * MANAGEMENT TRAYS
	 */

	const fetchNodes = async () => requireSuccessfulCall(await Runtime.Get('CONTROLLER', 'getNodes'));

	const prepareControllerManagementData = (controller) => {
		controller.backgroundRSSI = controller.statistics.backgroundRSSI
			? FlattenChannelAverages(controller.statistics.backgroundRSSI)
			: {};
		delete controller.statistics.backgroundRSSI;
		$('#zwjs-controller-info').data('info', controller);
	};

	const ShowNetworkManagement = async () => {
		if (!networkId) return;
		CloseTray();
		if (BootLoaderMode) return ShowRecovery();

		try {
			const controller = (await fetchNodes()).find((node) => node.isControllerNode);
			prepareControllerManagementData(controller);
			showManagementTray('ZWave JS Controller Management', TPL_ControllerManagement, {
				Network: $('#zwjs-controller-info').text(),
				Status: $('#zwjs-controller-status').text()
			});
		} catch (error) {
			ZWJSAlert(error.message || error);
		}
	};

	const refreshSelectedNodeData = async () => {
		const node = (await fetchNodes()).find((candidate) => candidate.nodeId === selectedNode.nodeId);
		delete node.statistics.lwr;
		const group = GetNodeGroup(selectedNode.nodeLocation);
		group.children.find((item) => item.nodeData.nodeId === node.nodeId).nodeData = node;
		return node;
	};

	const ShowNodeManagement = async () => {
		if (!selectedNode) return;
		CloseTray();
		try {
			await refreshSelectedNodeData();
			showManagementTray('ZWave JS Node Management', TPL_NodeManagement, {
				NodeID: $('#zwjs-node-info-id').text(),
				Status: $('#zwjs-node-status').text(),
				NodeInfo: $('#zwjs-node-info').text()
			});
		} catch (error) {
			ZWJSAlert(error.message || error);
		}
	};

	const InterviewCurrentNode = async () => {
		if (!selectedNode) {
			return;
		}
		if (await ZWJSConfirm('Are you sure you wish to re-interview this Node?')) {
			Runtime.Post('NODE', 'refreshInfo', { nodeId: selectedNode.nodeId })
				.then((data) => {
					if (!data.callSuccess) {
						ZWJSAlert(data.response);
					}
				})
				.catch((Error) => {
					ZWJSAlert(Error.message);
				});
		}
	};

	const getAdvancedTemplate = (templateId) => {
		let template = AdvancedPanels.find((panel) => panel.id === templateId);
		if (!template) {
			template = { id: templateId, compiled: Handlebars.compile($(`#${templateId}`).html()) };
			AdvancedPanels.push(template);
		}
		return template.compiled;
	};

	const resolveAdvancedPanelData = async (source) => {
		if (!source) return {};
		if (RenderFunctions[source]) return RenderFunctions[source]();
		if (typeof source === 'object') return source;
		if (typeof source === 'string') return DecodeObject(source);
		return {};
	};

	const RenderAdvanced = async (templateId, target, dataSource, writeTarget) => {
		try {
			const render = getAdvancedTemplate(templateId);
			const data = await resolveAdvancedPanelData(dataSource);
			const container = $(writeTarget || '#zwjs-advanced-content');
			container.empty().append(render(data));

			if (target) {
				$('.zwjs-tray-menu div').removeAttr('active');
				$(target).attr('active', '');
			}
		} catch (error) {
			ZWJSAlert(error.message || error);
		}
	};

	/*
	 * MAP ACTIONS
	 */

	const RenderD3Map = (selector, nodes, links, layoutLinks) => {
		const container = ZWJSD3.select(selector);
		if (container.empty()) return;

		container.selectAll('*').remove();
		container.style('position', 'relative').style('width', '100%').style('height', '100%');

		const element = container.node();
		let width = element.clientWidth || 800;
		let height = element.clientHeight || 500;
		const routeColour = ZWJSD3.scaleOrdinal(ZWJSD3.schemeTableau10);
		const nodeMap = new Map(nodes.map((node) => [node.id, node]));

		links.forEach((link) => {
			link.source = typeof link.source === 'object' ? link.source : nodeMap.get(link.source);
			link.target = typeof link.target === 'object' ? link.target : nodeMap.get(link.target);
		});

		const details = container
			.append('div')
			.style('display', 'none')
			.style('position', 'absolute')
			.style('z-index', 10)
			.style('top', '10px')
			.style('right', '10px')
			.style('min-width', '220px')
			.style('padding', '10px')
			.style('background', '#fff')
			.style('border', '1px solid #aaa')
			.style('border-radius', '4px')
			.style('box-shadow', '0 2px 8px rgba(0,0,0,0.2)')
			.style('font-size', '12px');

		const svg = container
			.append('svg')
			.attr('width', '100%')
			.attr('height', '100%')
			.attr('viewBox', [0, 0, width, height])
			.on('click', () => {
				details.style('display', 'none');
				link.attr('opacity', 1);
			});

		const graph = svg.append('g');

		svg
			.append('defs')
			.append('marker')
			.attr('id', 'zwjs-d3-arrow')
			.attr('viewBox', '0 -5 10 10')
			.attr('refX', 26)
			.attr('markerWidth', 6)
			.attr('markerHeight', 6)
			.attr('orient', 'auto')
			.append('path')
			.attr('d', 'M0,-5L10,0L0,5')
			.attr('fill', '#999');

		svg.call(
			ZWJSD3.zoom()
				.scaleExtent([0.2, 4])
				.on('zoom', (event) => graph.attr('transform', event.transform))
		);

		const link = graph
			.append('g')
			.selectAll('line')
			.data(links)
			.join('line')
			.attr('stroke', (d) => (d.direct ? '#28a745' : routeColour(d.routeId)))
			.attr('stroke-width', 2)
			.attr('marker-end', (d) => (d.destination ? 'url(#zwjs-d3-arrow)' : null));

		const node = graph
			.append('g')
			.selectAll('g')
			.data(nodes)
			.join('g')
			.style('cursor', 'grab')
			.on('click', (event, d) => {
				event.stopPropagation();

				if (d.type === 'controller') {
					link.attr('opacity', 1);
				} else {
					link.attr('opacity', (l) => (l.routeId === d.id ? 1 : 0.15));
				}

				const rows = [
					['Status', d.status],
					['Location', d.location],
					['Manufacturer', d.manufacturer],
					['Device', d.label],
					['Firmware', d.firmwareVersion],
					['Power', d.power],
					['Security', d.security],
					['RSSI', d.rssi !== undefined ? `${d.rssi} dBm` : undefined],
					['RTT', d.rtt !== undefined ? `${d.rtt} ms` : undefined],
					['Route', d.route?.join(' → ')]
				].filter((row) => row[1] !== undefined && row[1] !== '');

				details
					.html(
						`<div style="font-weight:bold;font-size:14px;margin-bottom:8px">${d.type === 'controller' ? `Controller - Node ${d.id}` : `Node ${d.id} - ${d.name}`}</div>` +
							rows.map((row) => `<div><strong>${row[0]}:</strong> ${row[1]}</div>`).join('')
					)
					.style('display', 'block');
			});

		node
			.append('circle')
			.attr('r', 20)
			.attr('fill', (d) => (d.status === 'Dead' ? '#d9534f' : d.type === 'controller' ? '#5b9bd5' : '#fff'))
			.attr('stroke', '#777')
			.attr('stroke-width', 2);

		node
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'central')
			.attr('font-family', 'FontAwesome')
			.attr('font-size', 16)
			.attr('fill', (d) => (d.status === 'Dead' ? '#fff' : '#000'))
			.text((d) => (d.type === 'controller' ? '\uf1eb' : d.type === 'mains' ? '\uf1e6' : '\uf240'));

		node
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('y', 36)
			.attr('font-size', 12)
			.attr('font-weight', 'bold')
			.text((d) => `${d.id} - ${d.name}`);

		node
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('y', 50)
			.attr('font-size', 10)
			.text((d) => d.device);

		const Tick = () => {
			link.each(function (d) {
				const dx = d.target.x - d.source.x;
				const dy = d.target.y - d.source.y;
				const length = Math.sqrt(dx * dx + dy * dy) || 1;
				const ox = (-dy / length) * d.offset * 4;
				const oy = (dx / length) * d.offset * 4;

				ZWJSD3.select(this)
					.attr('x1', d.source.x + ox)
					.attr('y1', d.source.y + oy)
					.attr('x2', d.target.x + ox)
					.attr('y2', d.target.y + oy);
			});
			node.attr('transform', (d) => `translate(${d.x},${d.y})`);
		};

		let simulation = ZWJSD3.forceSimulation(nodes)
			.force(
				'link',
				ZWJSD3.forceLink(layoutLinks)
					.id((d) => d.id)
					.distance((d) => (d.direct ? 220 : 90))
					.strength((d) => (d.direct ? 0.08 : 1))
			)
			.force('charge', ZWJSD3.forceManyBody().strength(-100).distanceMax(400))
			.force('center', ZWJSD3.forceCenter(width / 2, height / 2))
			.force('collision', ZWJSD3.forceCollide().radius(70).strength(1))
			.on('tick', Tick);

		node.call(
			ZWJSD3.drag()
				.on('start', function (event, d) {
					simulation.stop();
					d.fx = d.x;
					d.fy = d.y;
					ZWJSD3.select(this).style('cursor', 'grabbing');
				})
				.on('drag', (event, d) => {
					d.x = d.fx = event.x;
					d.y = d.fy = event.y;
					Tick();
				})
				.on('end', function (event, d) {
					d.fx = d.x;
					d.fy = d.y;
					ZWJSD3.select(this).style('cursor', 'grab');

					const children = new Set([d.id]);
					let found = true;
					while (found) {
						found = false;
						layoutLinks.forEach((link) => {
							const source = typeof link.source === 'object' ? link.source.id : link.source;
							const target = typeof link.target === 'object' ? link.target.id : link.target;
							if (children.has(source) && !children.has(target)) {
								children.add(target);
								found = true;
							}
						});
					}

					if (children.size === 1) return;

					nodes.forEach((node) => {
						if (node !== d && children.has(node.id)) {
							node.fx = null;
							node.fy = null;
						}
						node.vx = 0;
						node.vy = 0;
					});

					simulation.stop();
					simulation = ZWJSD3.forceSimulation(nodes)
						.force(
							'link',
							ZWJSD3.forceLink(layoutLinks)
								.id((node) => node.id)
								.distance((link) => (link.direct ? 220 : 90))
								.strength((link) => (link.direct ? 0.08 : 1))
						)
						.force('charge', ZWJSD3.forceManyBody().strength(-100).distanceMax(400))
						.force('center', ZWJSD3.forceCenter(width / 2, height / 2))
						.force('collision', ZWJSD3.forceCollide().radius(70).strength(1))
						.alpha(1)
						.on('tick', Tick);
				})
		);

		new ResizeObserver(() => {
			width = element.clientWidth;
			height = element.clientHeight;
			svg.attr('viewBox', [0, 0, width, height]);
			simulation
				.force('center', ZWJSD3.forceCenter(width / 2, height / 2))
				.alpha(0.3)
				.restart();
		}).observe(element);
	};

	const RenderMap = async (target = '#zwjs-d3') => {
		const nodes = requireSuccessfulCall(await Runtime.Get('CONTROLLER', 'getNodes'));
		const controller = nodes.find((node) => node.isControllerNode);
		const devices = nodes.filter((node) => !node.isControllerNode);

		const mapNodes = [
			{
				id: controller.nodeId,
				name: 'Controller',
				type: 'controller',
				device: `${controller.deviceConfig?.manufacturer} - ${controller.deviceConfig?.label}`,
				status: controller.status,
				manufacturer: controller.deviceConfig?.manufacturer,
				label: controller.deviceConfig?.label,
				firmwareVersion: controller.firmwareVersion,
				power: 'Mains'
			}
		];
		const mapLinks = [];
		const layoutLinks = [];

		devices.forEach((node) => {
			const repeaters = node.statistics?.lwr?.repeaters || [];
			const route = [controller.nodeId, ...repeaters, node.nodeId];

			mapNodes.push({
				id: node.nodeId,
				name: node.nodeName || 'No Name',
				type: node.powerSource.type === 'mains' ? 'mains' : 'battery',
				device: `${node.deviceConfig?.manufacturer} - ${node.deviceConfig?.label}`,
				status: node.status,
				location: node.nodeLocation,
				manufacturer: node.deviceConfig?.manufacturer,
				label: node.deviceConfig?.label,
				firmwareVersion: node.firmwareVersion,
				power:
					node.powerSource.type === 'battery'
						? `Battery${node.powerSource.level !== undefined ? ` (${node.powerSource.level}%)` : ''}`
						: 'Mains',
				security: node.isSecure ? `S${node.highestSecurityClass}` : 'None',
				rssi: node.statistics?.lwr?.rssi,
				rtt: node.statistics?.rtt,
				route
			});

			for (let i = 0; i < route.length - 1; i++) {
				mapLinks.push({
					source: route[i],
					target: route[i + 1],
					routeId: node.nodeId,
					direct: repeaters.length === 0,
					destination: i === route.length - 2,
					offset: 0
				});
			}

			layoutLinks.push({
				source: repeaters.length ? repeaters[repeaters.length - 1] : controller.nodeId,
				target: node.nodeId,
				direct: repeaters.length === 0
			});
		});

		const groups = new Map();
		mapLinks.forEach((link) => {
			const key = [link.source, link.target].sort((a, b) => a - b).join('-');
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key).push(link);
		});
		groups.forEach((links) => {
			links.forEach((link, index) => (link.offset = index - (links.length - 1) / 2));
		});

		RenderD3Map(target, mapNodes, mapLinks, layoutLinks);
	};

	const RenderMapDialog = async () => {
		const MapWindow = window.open('', 'ZWaveJSTopology', 'popup=yes,width=1200,height=800,resizable=yes,scrollbars=no');
		if (!MapWindow) {
			ZWJSAlert('The topology map popup was blocked by the browser');
			return;
		}
		MapWindow.document.write(`
		<!DOCTYPE html>
		<html style="width:100%;height:100%;margin:0;padding:0;">
			<head>
				<title>Z-Wave Topology Map</title>
				<link rel="stylesheet" href="resources/node-red-contrib-zwave-js/UITab/styles.css">
				<link rel="stylesheet" href="vendor/font-awesome/css/font-awesome.min.css">
			</head>
			<body style="width:100%;height:100%;margin:0;padding:15;overflow:hidden;">
				<div id="zwjs-d3" style="position:absolute;inset:0;width:100%;height:100%;"></div>
				<div class="zwjs-hint" style="position:absolute;z-index:10;top:10px;left:10px;max-width:500px;">
					The map is based on statistics for each Z-Wave Node, specifically the <strong>Last Working Route(s)</strong> to the Node, from the Controller
				</div>
			</body>
		</html>
	`);
		MapWindow.document.close();

		await RenderMap($('#zwjs-d3', MapWindow.document)[0]);
	};

	/*
	 * RENDER ACTIONS
	 */

	const RenderFunctions = {
		async CheckFUS() {
			const updates = requireSuccessfulCall(
				await Runtime.Post('CONTROLLER', 'getAllAvailableFirmwareUpdates', [{ includePrereleases: true }])
			);
			if (!Object.keys(updates).length) {
				throw 'No updates available.';
			}
			return { Updates: updates, Message: getFUSLicenseStatus() };
		},

		async PrepFUS() {
			return { Message: getFUSLicenseStatus() };
		},

		async GetRRCurrentProgress() {
			const result = await Runtime.Get(undefined, undefined, `zwave-js/ui/${networkId}/rebuildroutesprogress`);
			if (result.callSuccess && result.response !== false) {
				commsRebuildRoutesProgress(undefined, { Progress: result.response });
			}
		},

		async ListSplitters() {
			const splitters = RED.nodes
				.filterNodes({ type: 'zwavejs-splitter' })
				.map((node) => ({ name: node.name, id: node.id }));

			const labelParts = [ViewingValueID.commandClassName, ViewingValueID.propertyName];
			if (ViewingValueID.propertyKeyName) labelParts.push(ViewingValueID.propertyKeyName);

			return {
				splitters,
				label: labelParts.map((part) => part.replace(/ /g, '_').toUpperCase()).join('.'),
				shape: ViewingValueID
			};
		},

		async PrepFailed() {
			const nodes = requireSuccessfulCall(await Runtime.Get('CONTROLLER', 'getNodes'));
			return { nodes: nodes.filter((node) => node.status === 'Dead') };
		},

		async ControllerInfo() {
			const controllerData = $('#zwjs-controller-info').data('info');
			const versions = await Runtime.Get(undefined, undefined, `zwave-js/ui/${networkId}/version`);
			return {
				configuration: $('#zwjs-network option:selected').text(),
				serialPort: RED.nodes.node(networkId).serialPort,
				...versions.response,
				...controllerData
			};
		},

		async ControllerStats() {
			const controllerData = $('#zwjs-controller-info').data('info');
			const result = {
				statistics: FormatObjectKeys(controllerData.statistics),
				backgroundRSSI: FormatObjectKeys(controllerData.backgroundRSSI)
			};
			result.backgroundRSSI.Timestamp = formatDateTime(result.backgroundRSSI.Timestamp);
			return result;
		},

		async ControllerSettings() {
			const regionResult = await Runtime.Get('CONTROLLER', 'getRFRegion');
			const powerResult = await Runtime.Get('CONTROLLER', 'getPowerlevel');
			const longRangePowerResult = await Runtime.Get('CONTROLLER', 'getMaxLongRangePowerlevel');

			return {
				Region: regionResult.callSuccess ? `0x${regionResult.response.toString(16).padStart(2, '0')}` : regionResult,
				RDisabled: regionResult.callSuccess ? '' : 'disabled="disabled"',
				Power: powerResult.callSuccess ? powerResult.response.powerlevel : powerResult,
				LRPower: longRangePowerResult.callSuccess ? longRangePowerResult.response : longRangePowerResult
			};
		},

		async NodeInfo() {
			return getSelectedNodeData();
		},

		async NodeStats() {
			const result = FormatObjectKeys(getSelectedNodeData().statistics);
			result['Last Seen'] = formatDateTime(result['Last Seen']);
			return result;
		},

		async NodeAssociationGroups() {
			AssociationGroups = requireSuccessfulCall(
				await Runtime.Post('CONTROLLER', 'getAllAssociationGroups', [selectedNode.nodeId])
			);
			return AssociationGroups;
		},

		async SetInclusionOptions() {
			setTimeout(() => {
				const config = RED.nodes.node(networkId);
				const hasS0 = config.securityKeys_S0_Legacy.length >= 32;
				const hasAllS2 = [
					config.securityKeys_S2_AccessControl,
					config.securityKeys_S2_Authenticated,
					config.securityKeys_S2_Unauthenticated
				].every((key) => key.length >= 32);

				const disableInclusionModes = (values) => {
					values.forEach((value) => {
						const input = $(`input[type="radio"][name="ZWJS_IS"][value="${value}"]`);
						input.attr('disabled', 'disabled');
						input.parent().css({ opacity: 0.4 });
					});
				};

				if (!hasAllS2) {
					disableInclusionModes(['0', '4', 'SS']);
					$('input[type="radio"][name="ZWJS_IS"][value="2"]').prop('checked', true);
				}
				if (!hasS0) {
					disableInclusionModes(['3']);
					if (!hasAllS2) $('input[type="radio"][name="IS"][value="2"]').prop('checked', true);
				}
			}, 10);
			return {};
		},

		async StartCamera() {
			setTimeout(() => {
				const videoElement = $('#zwjs-camera-view')[0];
				const options = {
					highlightCodeOutline: true,
					highlightScanRegion: true,
					calculateScanRegion: () => {
						const shortestDimension = Math.min(videoElement.videoWidth, videoElement.videoHeight);
						const size = Math.round(0.5 * shortestDimension);
						return {
							x: Math.round((videoElement.videoWidth - size) / 2),
							y: Math.round((videoElement.videoHeight - size) / 2),
							width: size,
							height: size
						};
					}
				};

				const handleScan = async (result) => {
					QRS.stop();
					const response = await Runtime.Post(
						undefined,
						undefined,
						[result.data],
						`zwave-js/ui/${networkId}/s2/parseqr`
					);
					if (!response.callSuccess) {
						ZWJSAlert(response.response);
						QRS.start();
						return;
					}
					if (response.response.isDSK) {
						ZWJSAlert('The QR Code you have scanned, is a DSK (Device Specific Key), it is not a Smart Start QR Code');
						QRS.start();
						return;
					}

					const provisioning = response.response.qrProvisioningInformation;
					const classes = provisioning.requestedSecurityClasses.map((classId) => ({
						classId,
						className: SClassMap[classId]
					}));
					provisioning.manufacturer = response.response.deviceConfig.manufacturer;
					provisioning.label = response.response.deviceConfig.label;

					RenderAdvanced('ZWJS_TPL_PrePro', undefined, {
						QRProvisioningInformation: btoa(JSON.stringify(provisioning)),
						DSK: provisioning.dsk,
						DeviceConfig: response.response.deviceConfig,
						classes
					});
				};

				QRS = new QrScanner(videoElement, handleScan, options);
				QRS.start();
			}, 50);
		},

		async PrepSSList() {
			const entries = requireSuccessfulCall(
				await Runtime.Get(undefined, undefined, `zwave-js/ui/${networkId}/s2/provisioningentries`)
			);
			entries.forEach((entry) => {
				entry.shortDSK = entry.dsk.split('-')[0];
				if (entry.status === 0) entry.checked = 'checked';
			});
			return { entries };
		}
	};

	/*
	 * NODE ACTIONS
	 */

	const RemoveFailedNode = async (NodeID, Row) => {
		const ID = NodeID || selectedNode?.nodeId;
		if (ID) {
			if (await ZWJSConfirm('Are you sure you wish to remove this Node from your network?')) {
				Runtime.Post('CONTROLLER', 'removeFailedNode', [ID]).then((data) => {
					if (data.callSuccess) {
						if (Row) {
							$(Row).closest('tr').remove();
						}
					} else {
						ZWJSAlert(data.response);
					}
				});
			}
		}
	};

	const PingNode = (NodeID) => {
		Runtime.Post('NODE', 'ping', { nodeId: NodeID }).then((data) => {
			if (data.callSuccess) {
				data.response ? ZWJSAlert('Ping was successful') : ZWJSAlert('Ping failed');
			} else {
				ZWJSAlert(data.response);
			}
		});
	};

	const SetNameLocation = async (button) => {
		DisableButton(button);
		try {
			const node = requireSelectedNode();
			requireSuccessfulCall(
				await Runtime.Post('NODE', 'setName', {
					nodeId: node.nodeId,
					value: $('#zwjs-node-edit-name').val() || undefined
				})
			);
			requireSuccessfulCall(
				await Runtime.Post('NODE', 'setLocation', {
					nodeId: node.nodeId,
					value: $('#zwjs-node-edit-location').val() || undefined
				})
			);

			await RefreshNodes('Named');
			ZWJSAlert('Name & Location Set Successfully!');
		} catch (error) {
			ZWJSAlert(toError(error).message);
		} finally {
			EnableButton(button);
		}
	};

	const healthCheckTopic = () => `zwave-js/ui/${networkId}/nodes/healthcheck`;

	const renderHealthRating = (rating) => {
		const state = rating > 5 ? 'good' : rating > 3 ? 'warn' : 'bad';
		return `<div class="zwjs-rating" ${state}>${rating}/10</div>`;
	};

	const addHealthTestingRow = () => {
		$('#zwjs-node-health-check').append(
			'<tr><td style="text-align:center"><div class="zwjs-rating" wait>Testing...</div></td><td style="text-align:center">---</td><td style="text-align:center">---</td><td style="text-align:center">---</td><td style="text-align:center">---</td><td style="text-align:center">---</td><td style="text-align:center">---</td><td style="text-align:center">---</td></tr>'
		);
	};

	const renderHealthCheckResult = (result) => {
		$('#zwjs-node-health-check tr:last').remove();
		$('#zwjs-node-health-check').append(
			`<tr><td style="text-align:center">${renderHealthRating(result.rating)}</td><td style="text-align:center">${result.failedPingsNode}</td><td style="text-align:center">${result.failedPingsController ?? 0}</td><td style="text-align:center">${result.routeChanges}</td><td style="text-align:center">${result.latency} ms</td><td style="text-align:center">${result.numNeighbors}</td><td style="text-align:center">${result.minPowerlevel} dBm</td><td style="text-align:center">${result.snrMargin} dBm</td></tr>`
		);
		addHealthTestingRow();
	};

	const CheckNodeHealth = async (button) => {
		DisableButton(button);
		const node = requireSelectedNode();
		const topic = healthCheckTopic(); // Snapshot before an async operation can change networks.
		const feedback = (unusedTopic, data) => {
			const lastResult = data?.check?.lastResult;
			if (lastResult) renderHealthCheckResult(lastResult);
		};

		$('#zwjs-node-health-check').find('tr:gt(0)').remove();
		RED.comms.subscribe(topic, feedback);
		addHealthTestingRow();

		try {
			requireSuccessfulCall(await Runtime.Post('NODE', 'checkLifelineHealth', { nodeId: node.nodeId }));
			await new Promise((resolve) => setTimeout(resolve, 250));
		} catch (error) {
			ZWJSAlert(toError(error).message);
		} finally {
			EnableButton(button);
			$('#zwjs-node-health-check tr:last').remove();
			RED.comms.unsubscribe(topic, feedback);
		}
	};

	/*
	 * ASSOCIATIONS
	 */

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
			Mapped.forEach((v) => {
				let EP;
				switch (v.endpoint) {
					case undefined:
						EP = '<span class="zwjs-asso-ep">NODE</span>';
						break;

					case 0:
						EP = '<span class="zwjs-asso-ep">ROOT</span>';
						break;

					default:
						EP = `<span class="zwjs-asso-ep">EP${v.endpoint}</span>`;
						break;
				}

				$('#zwjs-asso-mappings').append(
					`<tr><td style="text-align:center"><span class="zwjs-node-id">${v.nodeId}</span></td><td style="text-align:center">${EP}</td><td style="text-align:center"><i class="fa fa-trash" aria-hidden="true" style="font-size: 18px;color: red; cursor:pointer" onclick="ZWaveJS.MarkAssoDelete(this)"></i></td></tr>`
				);
			});
		});
	};

	const PreppNewAssociation = () => {
		$('#zwjs-asso-mappings').append(
			'<tr data-role="zwjs-new-association"><td style="text-align:center"><input type="number" data-role="zwjs-node" value="1" min="1"></td><td style="text-align:center"><input type="number" data-role="zwjs-endpoint" min="0" placeholder="<Empty: Node-Association>"></td><td>&nbsp;</td></tr>'
		);
	};

	const readAssociationAddresses = (rowSelector, nodeSelector, endpointSelector) => {
		const addresses = [];
		$(rowSelector).each(function () {
			const row = $(this);
			const isTableRow = nodeSelector === 'td';
			const nodeValue = isTableRow ? row.find('td').first().text() : row.find(nodeSelector).first().val();
			const endpointValue = isTableRow
				? row.find('td').first().next().text()
				: row.find(endpointSelector).first().val();
			const endpoint = parseInt(endpointValue);
			addresses.push({ nodeId: parseInt(nodeValue), endpoint: isNaN(endpoint) ? undefined : endpoint });
		});
		return addresses;
	};

	const getSelectedAssociationGroup = () => [
		{ nodeId: selectedNode.nodeId, endpoint: parseInt($('#zwjs-asso-endpoints').val()) },
		parseInt($('#zwjs-asso-groups').val())
	];

	const CommitAssociations = async (button) => {
		DisableButton(button);
		try {
			const addresses = readAssociationAddresses("[data-role='zwjs-remove-association']", 'td', 'td');
			if (addresses.length) {
				const result = await Runtime.Post('CONTROLLER', 'removeAssociations', [
					...getSelectedAssociationGroup(),
					addresses
				]);
				if (!result.callSuccess) throw new Error(result.response);
			}
			await CommitAssociationsAdd(button);
		} catch (error) {
			EnableButton(button);
			ZWJSAlert(error.message || error);
		}
	};

	const ResetAllAssociations = async (button) => {
		const confirmed = await ZWJSConfirm(
			'Are you sure you wish to wipe all Associations? this includes the LifeLine associations, you will need to re-create them after.'
		);
		if (!confirmed) return;

		DisableButton(button);
		try {
			const endpoints = requireSuccessfulCall(
				await Runtime.Post('CONTROLLER', 'getAllAssociations', [selectedNode.nodeId])
			);
			const removals = [];
			endpoints.forEach((endpoint) => {
				Object.entries(endpoint.associations).forEach(([group, addresses]) => {
					if (addresses.length) {
						removals.push(
							Runtime.Post('CONTROLLER', 'removeAssociations', [
								endpoint.associationAddress,
								parseInt(group),
								addresses
							])
						);
					}
				});
			});
			await Promise.all(removals);
			ZWJSAlert('All associations successfully removed!');
			processAssociationGPSelect();
		} catch (error) {
			ZWJSAlert(error.message || error);
		} finally {
			EnableButton(button);
		}
	};

	const MarkAssoDelete = (El) => {
		$(El).closest('tr').attr('data-role', 'zwjs-remove-association');
		$(El).closest('tr').css({ filter: 'grayscale()' });
	};

	const finishAssociationUpdate = (button) => {
		ZWJSAlert('Associations have been successfully updated!');
		EnableButton(button);
		processAssociationGPSelect();
	};

	const CommitAssociationsAdd = async (button) => {
		try {
			const addresses = readAssociationAddresses(
				"[data-role='zwjs-new-association']",
				"[data-role='zwjs-node']",
				"[data-role='zwjs-endpoint']"
			);
			if (addresses.length) {
				const result = await Runtime.Post('CONTROLLER', 'addAssociations', [
					...getSelectedAssociationGroup(),
					addresses
				]);
				if (!result.callSuccess) throw new Error(result.response);
			}
			finishAssociationUpdate(button);
		} catch (error) {
			EnableButton(button);
			ZWJSAlert(error.message || error);
		}
	};

	/*
	 * INCLUSION AND EXCLUSION
	 */

	const StartExclusion = () => {
		Runtime.Get('CONTROLLER', 'beginExclusion').then((R) => {
			if (R.callSuccess) {
				RenderAdvanced('ZWJS_TPL_NIFWait', undefined, { mode: 'Exclusion' });
			} else {
				ZWJSAlert(R.response);
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
					ZWJSAlert(R.response);
				}
			});
		} else {
			RenderAdvanced('ZWJS_TPL_QRRead', undefined, 'StartCamera');
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
				DisableButton(Button);
			} else {
				ZWJSAlert(R.response);
			}
		});
	};

	const SubmitDSK = (Button) => {
		Runtime.Post(undefined, undefined, [$('#zwjs-dsk').val()], `zwave-js/ui/${networkId}/s2/dsk`).then((R) => {
			if (R.callSuccess) {
				DisableButton(Button);
			} else {
				ZWJSAlert(R.response);
			}
		});
	};

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
				ZWJSAlert(R.response);
			}
		});
	};

	const SetPEActive = (El, Entry) => {
		Entry = DecodeObject(Entry);
		delete Entry.checked;
		delete Entry.shortDSK;
		Entry.status = $(El).prop('checked') ? 0 : 1;

		Runtime.Post('CONTROLLER', 'provisionSmartStartNode', [Entry]).then((R) => {
			if (!R.callSuccess) {
				ZWJSAlert(R.response);
			}
		});
	};

	const DeletePE = async (El, Entry) => {
		if (
			await ZWJSConfirm(
				'Are you sure you wish to delete this Provisioning Entry? Note: it will not exclude the device.'
			)
		) {
			Entry = DecodeObject(Entry);
			delete Entry.checked;
			delete Entry.shortDSK;
			Runtime.Post('CONTROLLER', 'unprovisionSmartStartNode', [Entry.dsk]).then((R) => {
				if (R.callSuccess) {
					$(El).parent().parent().remove();
				} else {
					ZWJSAlert(R.response);
				}
			});
		}
	};

	const JoinAsSlave = (Button) => {
		Runtime.Get('CONTROLLER', 'beginJoiningNetwork').then((R) => {
			if (!R.callSuccess) {
				EnableButton(Button);
				ZWJSAlert(R.response);
			} else {
				const Result = R.response;
				switch (Result) {
					case 0:
						DisableButton(Button);
						break;
					case 1:
						ZWJSAlert('The Controller is currently too busy to perform the join.');
						break;
					case 2:
						ZWJSAlert("The Controller's role does not permit joining as a secondary controller - try resetting it!");
						break;
					case 3:
						ZWJSAlert('An unknown error occured.');
						break;
				}
			}
		});
	};

	const LeaveAsSlave = (Button) => {
		DisableButton(Button);
		Runtime.Get('CONTROLLER', 'beginLeavingNetwork').then((R) => {
			if (!R.callSuccess) {
				EnableButton(Button);
				ZWJSAlert(R.response);
			}
		});
	};

	/*
	 * CONTROLLER ACTIONS
	 */

	const BackupNames = async (button) => {
		DisableButton(button);
		try {
			const nodes = requireSuccessfulCall(await Runtime.Get('CONTROLLER', 'getNodes'));
			const controllerInfo = $('#zwjs-controller-info').data('info');
			if (!controllerInfo?.homeId) throw new Error('Controller information is not available');

			const namesAndLocations = nodes
				.filter((node) => node.nodeName !== undefined || node.nodeLocation !== undefined)
				.map((node) => ({ nodeId: node.nodeId, name: node.nodeName, location: node.nodeLocation }));

			downloadBlob(
				new Blob([JSON.stringify(namesAndLocations, null, 2)], { type: 'application/json' }),
				`zwave_names_locations_${controllerInfo.homeId}.json`
			);
		} catch (error) {
			ZWJSAlert(toError(error).message);
		} finally {
			EnableButton(button);
		}
	};

	const RestoreNames = async (button) => {
		DisableButton(button);
		try {
			const selected = await selectFile(async (file) => {
				const text = await file.text();
				const nodes = JSON.parse(text);
				if (!Array.isArray(nodes)) throw new Error('The selected backup does not contain a node list');

				for (const node of nodes) {
					if (!Number.isInteger(node?.nodeId)) throw new Error('The selected backup contains an invalid node entry');
					requireSuccessfulCall(
						await Runtime.Post('NODE', 'setLocation', { nodeId: node.nodeId, value: node.location || undefined })
					);
					requireSuccessfulCall(
						await Runtime.Post('NODE', 'setName', { nodeId: node.nodeId, value: node.name || undefined })
					);
				}
			});

			if (!selected) return;
			await RefreshNodes('Named');
			ZWJSAlert('Restore Completed Successfully');
		} catch (error) {
			ZWJSAlert(toError(error).message);
		} finally {
			EnableButton(button);
		}
	};

	const CFGUpdate = () => {
		Runtime.Post('DRIVER', 'checkForConfigUpdates').then(async (data) => {
			if (data.callSuccess) {
				if (data.response !== undefined) {
					const UD = await ZWJSConfirm(
						`A configuration database update is available (${data.response}). Would you like to update?`
					);
					if (UD) {
						Runtime.Post('DRIVER', 'installConfigUpdate').then((res) => {
							if (res.callSuccess && res.response) {
								ZWJSAlert('Update was installed.');
							} else {
								ZWJSAlert(`Update was not installed: ${res.response}.`);
							}
						});
					}
				} else {
					ZWJSAlert('No update available.');
				}
			} else {
				ZWJSAlert(data.response);
			}
		});
	};

	const UpdateSplitter = () => {
		const Node = RED.nodes.node($('#zwjs-splitters').val());

		const NextIndex = Node.splits.length ? Math.max(...Node.splits.map((x) => x.index)) + 1 : 0;

		const entry = {
			valueId: JSON.parse(CodeEditor.getValue()),
			index: NextIndex,
			name: $('#zwjs-splitter-output-name').val(),
			strict: $('#zwjs-splitter-output-endpoint').prop('checked')
		};

		if (entry.valueId.commandClass === undefined) {
			entry.custom = true;
		}

		Node.splits.push(entry);

		Node.outputs++;
		Node.dirty = true;
		Node.changed = true;
		Node.resize = true;

		RED.view.redraw(true);
		RED.nodes.dirty(true);

		CloseTray();
	};

	const RebuildNodeRoutes = () => {
		Runtime.Post('CONTROLLER', 'rebuildNodeRoutes', [selectedNode.nodeId]).then((data) => {
			if (data.callSuccess) {
				ZWJSAlert('Rebuiliding Node routes completed successfully.');
			} else {
				ZWJSAlert(data.response);
			}
		});
	};

	const RebuildRoutes = (button, battery) => {
		button && DisableButton(button);
		const Battery = battery || $('#zwjs-routes-battery').prop('checked');
		Runtime.Post('CONTROLLER', 'beginRebuildingRoutes', [{ includeSleeping: Battery }]).then((data) => {
			if (data.callSuccess) {
				button && EnableButton(button);
			} else {
				ZWJSAlert(data.response);
				button && EnableButton(button);
			}
		});
	};

	const SetClassicPowerLevel = (button) =>
		runButtonAction(button, async () => {
			const powerLevel = Number.parseInt($('#zwjs-controller-setting-power-classic').val(), 10);
			if (!Number.isFinite(powerLevel)) throw new Error('Select a valid classic power level');
			requireSuccessfulCall(await Runtime.Post('CONTROLLER', 'setPowerlevel', [powerLevel, 0]));
			ZWJSAlert('Power Level Set Succcessfully');
		});

	const SetLWPowerLevel = (button) =>
		runButtonAction(button, async () => {
			const powerLevel = Number.parseInt($('#zwjs-controller-setting-power-lr').val(), 10);
			if (!Number.isFinite(powerLevel)) throw new Error('Select a valid Long Range power level');
			requireSuccessfulCall(await Runtime.Post('CONTROLLER', 'setMaxLongRangePowerlevel', [powerLevel]));
			ZWJSAlert('Power Level Set Succcessfully');
		});

	const SetRegion = (button) =>
		runButtonAction(button, async () => {
			const region = Number.parseInt($('#zwjs-controller-setting-region option:selected').val(), 10);
			if (!Number.isFinite(region)) throw new Error('Select a valid RF region');
			requireSuccessfulCall(await Runtime.Post('CONTROLLER', 'setRFRegion', [region]));
			ZWJSAlert('Region Set Succcessfully');
		});

	const ResetController = async (Button) => {
		if (
			await ZWJSConfirm(
				'Are you sure you wish to continue? This will reset the controller back to Factory Standard, and if operating as the Primary Controller - will clear the Network of all Nodes.'
			)
		) {
			DisableButton(Button);
			Runtime.Get('DRIVER', 'hardReset').then((R) => {
				if (!R.callSuccess) {
					EnableButton(Button);
					ZWJSAlert(R.response);
				} else {
					EnableButton(Button);
					ZWJSAlert('The Controller has been Reset - It will now be refreshed in the UI');
					CloseTray();
					NetworkSelected();
				}
			});
		}
	};

	const RestoreController = async (button) => {
		if (
			!(await ZWJSConfirm(
				'Note: This will alter the Controllers NVM, and will be configured according to the backup file you will restore to - Do you wish to comntinue?'
			))
		)
			return;

		DisableButton(button);
		try {
			const selected = await selectFile(async (file) => {
				const byteArray = await readFileAsUint8Array(file);
				requireSuccessfulCall(await Runtime.Post('CONTROLLER', 'restoreNVM', [{ nvmData: byteArray }]));
			});
			if (selected)
				ZWJSAlert('The restore has been completed! - Please allow a few minutes for the controller to reboot.');
		} catch (error) {
			ZWJSAlert(toError(error).message);
		} finally {
			EnableButton(button);
		}
	};

	const BackupController = (button) =>
		runButtonAction(button, async () => {
			const nvm = requireSuccessfulCall(await Runtime.Get('CONTROLLER', 'backupNVMRaw'));
			const controllerInfo = $('#zwjs-controller-info').data('info');
			if (!controllerInfo?.homeId) throw new Error('Controller information is not available');

			const fileName = `zwave_nvm_${controllerInfo.homeId}.bin`;
			const blob = new Blob([new Uint8Array(Object.values(nvm))], { type: 'application/octet-stream' });
			ZWJSAlert(`Controller Backup is now completed, your browser will now downlaod the file: ${fileName}`);
			downloadBlob(blob, fileName);
			setTimeout(() => $('#zwjs-prog-contain-nvm').css({ display: 'none' }), 100);
		});

	/*
	 * FIRMWARE
	 */

	const getFUSLicenseStatus = () => {
		const Key = RED.nodes.node(networkId).apiKeys_firmwareUpdateService;
		if (!Key) {
			return "<strong>Non-Commercial</strong><br /><br />As no API key has been provided, you're confirming the environment is <strong>Non-Commercial</strong>.<br />An API Key for the Firmware Update Service is required for Commercial installs.";
		}
	};

	const handleBootloader = () => {
		BootLoaderMode = true;
		RED.notify(
			'WARNING! Your ZWave controller failed to boot, and is currently in recovery mode, please upload new firmware from the side bar',
			{ type: 'error', timeout: 30000 }
		);
	};

	const UpdateNFirmwareFUS = async (Node, Update) => {
		const FWI = DecodeObject(Update);
		if (
			await ZWJSConfirm(
				`Note: This will update the Node firmware to the update chosen (version: ${FWI.normalizedVersion}), do you wish to proceed?`
			)
		) {
			RenderAdvanced('ZWJS_TPL_Tray-Node-Firmware').then(() => {
				Runtime.Post('DRIVER', 'firmwareUpdateOTA', [Node, FWI]).catch((Error) => {
					ZWJSAlert(Error.message);
				});
			});
		}
	};

	const UpdateNFirmware = async (Button) => {
		if (await ZWJSConfirm("Note: This will update the Nodes's firmware, do you wish to proceed?")) {
			selectFile(async (file) => {
				DisableButton(Button);
				const byteArray = await readFileAsUint8Array(file);
				const msg = { nodeId: selectedNode.nodeId, args: [[{ data: byteArray }]] };
				Runtime.Post('NODE', 'updateFirmware', msg).catch((error) => ZWJSAlert(error.message));
			});
		}
	};

	const UpdateCFirmwareFUS = async (Update) => {
		const FWI = DecodeObject(Update);
		if (
			await ZWJSConfirm(
				`Note: This will update the Controllers firmware to the update chosen (version: ${FWI.normalizedVersion}), do you wish to proceed?`
			)
		) {
			RenderAdvanced('ZWJS_TPL_Tray-Controller-Firmware').then(() => {
				Runtime.Post('DRIVER', 'firmwareUpdateOTW', [FWI]).catch((Error) => {
					ZWJSAlert(Error.message);
				});
			});
		}
	};

	const UpdateCFirmware = async (Button) => {
		if (await ZWJSConfirm('Note: This will update the Controllers firmware, do you wish to proceed?')) {
			selectFile(async (file) => {
				DisableButton(Button);
				const byteArray = await readFileAsUint8Array(file);
				Runtime.Post('DRIVER', 'firmwareUpdateOTW', [{ data: byteArray }]).catch((error) => ZWJSAlert(error.message));
			});
		}
	};

	/*
	 * RUNTIME EVENTS
	 */

	const commsRebuildRoutesProgress = (topic, data) => {
		const nodes = {};
		const table = $('#zwjs-routes-progress')?.[0];
		if (table) {
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
						cell.innerHTML = `<span class="zwjs-node-id">${groups[col][i]}</span>`;
					}
				});
			}
		}
	};

	const commsStatus = (topic, data) => {
		$('#zwjs-controller-status').text(data.status);
		$('#zwjs-controller-status-tray').text(data.status);

		if (data.status === 'Bootloader ready.') {
			handleBootloader();
		} else {
			BootLoaderMode = false;
			if (data.status === 'Driver ready.') {
				RefreshNodes('DriverReady');
			}
		}
	};

	const commsNodeState = (topic, data) => {
		GetNodeGroup(data.nodeInfo.nodeLocation).children.find((N) => N.nodeData.nodeId === data.nodeInfo.nodeId).nodeData =
			data.nodeInfo;

		if (
			selectedNode &&
			selectedNode.nodeId === data.nodeInfo.nodeId &&
			!topic.endsWith('sleep') &&
			!topic.endsWith('wakeup')
		) {
			nodeSelected(undefined, { nodeData: data.nodeInfo });
		}

		RenderNodeIconState(data.nodeInfo);
		RenderGroupIconState();
	};

	const commsNodeAdded = (topic, data) => {
		RefreshNodes('NewAdded', data.nodeId);
		RenderAdvanced('ZWJS_TPL_NAdded', undefined, data);
	};

	const commsNodeRemoved = (topic, data) => {
		RefreshNodes('NodeRemoved', data.nodeId);
		RenderAdvanced('ZWJS_TPL_NRemoved', undefined, data);
	};

	const commsHandleValueUpdate = (topic, data) => {
		if (selectedNode && selectedNode.nodeId === data.nodeId) {
			const ValueID = data.eventBody.valueId;
			let NewValue = data.eventBody.newValue;
			const Hash = getValueUpdateHash(ValueID);

			if (typeof NewValue === 'object' && !Array.isArray(NewValue)) {
				NewValue = '(Complex)';
			} else {
				const VI = SelectedNodeVIDs[Hash];
				if (VI) {
					VI.currentValue = NewValue;
					if (VI.metadata?.states && VI.metadata.states[NewValue]) {
						NewValue = VI.metadata?.states[NewValue];
					} else {
						if (VI.metadata?.unit) {
							NewValue = `${NewValue} (${VI.metadata.unit})`;
						}
					}
				}
			}

			const TargetElement = `#zwjs-value-${Hash}`;
			if ($(TargetElement).length > 0) {
				$(TargetElement).text(NewValue);
			}
		}
	};

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

	const commsNVMRestoreProgressReport = (topic, data) => {
		$('#zwjs-prog-contain-nvm').css({ display: 'block' });
		const Done = data.done;
		const Total = data.total;
		const Percentage = (Done / Total) * 100;
		$('#zwjs-prog-bar-nvm').css({ width: `${Percentage}%` });
		$('#zwjs-prog-bar-nvm').text(`${data.label} ${Math.round(Percentage)}%`);
	};

	const commsNVMBackupProgressReport = (topic, data) => {
		$('#zwjs-prog-contain-nvm').css({ display: 'block' });
		const Read = data.bytesRead;
		const Total = data.total;
		const Percentage = (Read / Total) * 100;
		$('#zwjs-prog-bar-nvm').css({ width: `${Percentage}%` });
		$('#zwjs-prog-bar-nvm').text(`${data.label} ${Math.round(Percentage)}%`);
	};

	const commsNFirmwareReport = (topic, data) => {
		if (topic.endsWith('progress')) {
			$('#zwjs-prog-contain-nfirmware').css({ display: 'block' });
			const Percentage = data.progress.progress;
			$('#zwjs-prog-bar-nfirmware').css({ width: `${Percentage}%` });
			$('#zwjs-prog-bar-nfirmware').text(`Flashing Chip... ${Math.round(Percentage)}%`);
		}

		if (topic.endsWith('finished')) {
			let Message;
			switch (data.result.status) {
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
					Message = 'This device does not support firmware updates';
					break;

				default:
					Message = 'The update was successfull, please wait a few minutes for the Node to reinitialize';
			}
			RenderAdvanced('ZWJS_TPL_Tray-Firmware-Done', undefined, { Message });
		}
	};

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
			RenderAdvanced('ZWJS_TPL_Tray-Firmware-Done', undefined, { Message });
		}
	};

	const commsRemoveNetwork = (network) => {
		const Networks = $('#zwjs-network');
		if (Networks.val() === network.id) {
			ClearSelection(true);
		}

		Networks.children(`option[value="${network.id}"]`).remove();
		SelectFirstNetwork();
	};

	const commsListOrAddNetworks = (fetch, network) => {
		const Networks = $('#zwjs-network');

		if (fetch) {
			Runtime.Get(undefined, undefined, 'zwave-js/ui/global/networks').then((data) => {
				if (data.callSuccess) {
					const IDs = Object.keys(data.response);
					IDs.forEach((k) => {
						Networks.append(new Option(data.response[k], k));
					});
					SelectFirstNetwork();
				}
			});
		} else {
			const found = Networks.children().filter((n) => n.val === network.id);
			if (found.length < 1) {
				Networks.append(new Option(network.name, network.id));
			}
			SelectFirstNetwork();
		}
	};

	const COMMS_HOOKS = [
		['status', commsStatus],
		['s2/grant', commsGrant],
		['s2/dsk', commsDSK],
		['nodes/added', commsNodeAdded],
		['nodes/removed', commsNodeRemoved],
		['nodes/interviewstarted', commsNodeState],
		['nodes/interviewfailed', commsNodeState],
		['nodes/interviewed', commsNodeState],
		['nodes/ready', commsNodeState],
		['nodes/sleep', commsNodeState],
		['nodes/wakeup', commsNodeState],
		['nodes/dead', commsNodeState],
		['nodes/alive', commsNodeState],
		['controller/slave/dsk', commsHandleSlaveOps],
		['controller/slave/joined', commsHandleSlaveOps],
		['controller/slave/left', commsHandleSlaveOps],
		['nodes/valueadded', commsHandleValueUpdate],
		['nodes/valueupdate', commsHandleValueUpdate],
		['controller/nvm/backupprogress', commsNVMBackupProgressReport],
		['controller/nvm/restoreprogress', commsNVMRestoreProgressReport],
		['driver/firmwareupdate/progress', commsCFirmwareReport],
		['driver/firmwareupdate/finished', commsCFirmwareReport],
		['nodes/firmwareupdate/progress', commsNFirmwareReport],
		['nodes/firmwareupdate/finished', commsNFirmwareReport],
		['rebuildroutes/progress', commsRebuildRoutesProgress]
	];

	const setSubscription = (subscribe, targetNetworkId = networkId) => {
		if (!targetNetworkId) return;
		const operation = RED.comms[subscribe ? 'subscribe' : 'unsubscribe'];
		COMMS_HOOKS.forEach(([topic, handler]) => {
			operation(`zwave-js/ui/${targetNetworkId}/${topic}`, handler);
		});
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
		RebuildRoutes,
		UpdateNFirmware,
		UpdateSplitter,
		RebuildNodeRoutes,
		CFGUpdate,
		UpdateCFirmwareFUS,
		UpdateNFirmwareFUS,
		ZoomUI,
		BackupNames,
		RestoreNames,
		ZWJSAlert,
		RenderMapDialog
	};
})();
