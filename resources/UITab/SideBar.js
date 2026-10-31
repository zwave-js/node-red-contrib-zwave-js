/* global RED, Handlebars, ZWJSD3, QrScanner */
// eslint-disable-next-line no-unused-vars
const ZWaveJS = (function () {
	/*
	 * Z-Wave JS sidebar for Node-RED.
	 *
	 * Layout of this file:
	 *   1. Constants and module state
	 *   2. Helpers: errors, runtime transport, files, encoding, formatting
	 *   3. Common UI: dialogs, buttons, trays, zoom
	 *   4. Initialisation
	 *   5. Network selection, node list, node selection
	 *   6. Command classes and values
	 *   7. Management trays, panel rendering and the topology map
	 *   8. Panel data providers (the data each tray panel renders with)
	 *   9. Actions: nodes, associations, inclusion, controller, firmware
	 *  10. Runtime events (comms) and the public API
	 *
	 * Naming: PascalCase functions are the public API, called from inline handlers in the HTML
	 * templates (see the return statement at the bottom). camelCase functions are internal.
	 */

	/*
	 * 1. CONSTANTS AND MODULE STATE
	 */

	const STATUS_BOOTLOADER = 'Bootloader ready.';
	const STATUS_DRIVER_READY = 'Driver ready.';
	const STALE_NODE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
	const NO_LOCATION = 'No Location';
	const ALL_NODES = 'All Nodes';

	// Refreshing the node list for one of these reasons invalidates the open node and tray.
	const NODE_CONTEXT_RESET_REASONS = new Set([
		'Refresh',
		'NetworkJoin',
		'NetworkLeft',
		'NetworkSelected',
		'DriverReady'
	]);

	// Node tree grouping, keyed by the mode number the sidebar buttons pass to NodeCollapseToggle.
	const GROUP_MODES = {
		1: { byLocation: true, expanded: true },
		2: { byLocation: true, expanded: false },
		3: { byLocation: false, expanded: true }
	};

	const SECURITY_CLASSES = {
		0: { name: 'S2 Unauthenticated', label: 'S2 | Unauthenticated' },
		1: { name: 'S2 Authenticated', label: 'S2 | Authenticated' },
		2: { name: 'S2 AccessControl', label: 'S2 | Access Control' },
		7: { name: 'S0 Legacy', label: 'S0 | Legacy' }
	};

	const SET_VALUE_OPTION_EXAMPLES = {
		transitionDuration: '30s, 1m, 1m10s',
		volume: 45
	};

	const SET_VALUE_FAILURES = {
		0: 'The Node does not support the command',
		1: 'The Node is working on the requested change',
		2: 'The Node rejected the change',
		3: 'The target Endpoint was not found on the Node',
		4: 'The set command has not been implemented for this CC',
		5: 'The provided value was not valid'
	};

	let networkId; // id of the selected Z-Wave JS network (config node)
	let selectedNode; // data of the node selected in the tree
	let selectedNodeValues = {}; // value hash -> { metadata, valueId, currentValue } for the selected node
	let viewingValueId; // value currently open in the value tray / mini editor
	let associationGroups; // association groups of the selected node, keyed by endpoint
	let clientSideAuth = false; // S2 inclusion: does the controller need client side auth
	let bootloaderMode = false; // controller is stuck in its bootloader and needs new firmware
	let groupMode = { ...GROUP_MODES[1] };
	let trayKind; // 'controller' | 'node' | 'value' while one of our trays is open
	let panels; // RED panel stack holding the node tree and the value list
	let codeEditor; // ace editor used by the value and splitter trays
	let qrScanner; // Smart Start QR code scanner
	let miniEditorDialog;
	const templates = {};

	/*
	 * 2. HELPERS
	 */

	// ---- errors ----

	const toError = (error, fallback = 'Unknown Z-Wave JS error') => {
		if (error instanceof Error) return error;
		if (typeof error === 'string' && error) return new Error(error);
		if (typeof error?.message === 'string' && error.message) return new Error(error.message);
		try {
			return new Error(error == null ? fallback : JSON.stringify(error));
		} catch {
			return new Error(fallback);
		}
	};

	const unwrap = (result) => {
		if (!result || result.callSuccess !== true) {
			throw toError(result?.response, 'The Z-Wave JS runtime call failed');
		}
		return result.response;
	};

	const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	// ---- runtime transport ----

	const request = (type, url, data) =>
		new Promise((resolve, reject) => {
			const options = {
				type,
				url,
				timeout: 0,
				dataType: 'json',
				success: resolve,
				error: (jqXHR, textStatus, errorThrown) => reject(new Error(`${textStatus}: ${errorThrown}`))
			};

			if (type === 'POST') {
				options.data = JSON.stringify(data);
				options.contentType = 'application/json';
			}

			$.ajax(options);
		});

	const networkUrl = (path) => `zwave-js/ui/${networkId}/${path}`;

	/*
	 * Talks to the Node-RED runtime for the selected network.
	 *   runtime.get / post / getPath / postPath resolve to the unwrapped `response`, and throw if the call failed.
	 *   runtime.raw.* resolve to the full { callSuccess, response } envelope, for callers that handle failure themselves.
	 * get/post address an API + method pair; getPath/postPath address any other path under the network (status, s2/...).
	 */
	const raw = {
		get: (api, method) => request('GET', networkUrl(`${api}/${method}`)),
		post: (api, method, data) => request('POST', networkUrl(`${api}/${method}`), data),
		getPath: (path) => request('GET', networkUrl(path)),
		postPath: (path, data) => request('POST', networkUrl(path), data)
	};

	const runtime = {
		raw,
		get: async (api, method) => unwrap(await raw.get(api, method)),
		post: async (api, method, data) => unwrap(await raw.post(api, method, data)),
		getPath: async (path) => unwrap(await raw.getPath(path)),
		postPath: async (path, data) => unwrap(await raw.postPath(path, data))
	};

	const fetchNodes = () => runtime.get('CONTROLLER', 'getNodes');

	// ---- files ----

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

	/** Opens the browser's file picker. Resolves to the chosen File, or undefined if the dialog was cancelled. */
	const pickFile = () =>
		new Promise((resolve) => {
			const input = document.createElement('input');
			input.type = 'file';
			input.style.display = 'none';
			document.body.appendChild(input);

			let settled = false;
			const finish = (file) => {
				if (settled) return;
				settled = true;
				window.removeEventListener('focus', onWindowFocus);
				input.remove();
				resolve(file);
			};

			// Browsers without a `cancel` event only reveal a cancelled dialog by the window regaining focus.
			// The delay gives a real selection time to arrive first.
			function onWindowFocus() {
				setTimeout(() => {
					if (!input.files?.length) finish(undefined);
				}, 300);
			}

			input.addEventListener('change', () => finish(input.files?.[0]), { once: true });
			input.addEventListener('cancel', () => finish(undefined), { once: true });
			window.addEventListener('focus', onWindowFocus);
			input.click();
		});

	const readFileAsUint8Array = async (file) => new Uint8Array(await file.arrayBuffer());

	// ---- encoding: objects <-> base64(UTF-8 JSON), used to pass objects through inline template handlers ----

	const encodeObject = (object) => {
		let binary = '';
		new TextEncoder().encode(JSON.stringify(object)).forEach((byte) => {
			binary += String.fromCharCode(byte);
		});
		return btoa(binary);
	};

	const decodeObject = (encoded) => {
		const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
		return JSON.parse(new TextDecoder().decode(bytes));
	};

	// ---- formatting ----

	const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

	const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

	const formatHex = (value, width = 2) => `0x${parseInt(value, 10).toString(16).padStart(width, '0').toUpperCase()}`;

	const formatDateTime = (timestamp) => {
		const date = new Date(timestamp);
		if (Number.isNaN(date.getTime())) return 'Not Available';

		const parts = new Intl.DateTimeFormat(navigator.language || 'en-GB', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23'
		}).formatToParts(date);

		const part = (type) => parts.find((p) => p.type === type)?.value;
		// Keep the locale's day/month/year order, but always separate with dots.
		const datePart = parts
			.filter((p) => ['day', 'month', 'year'].includes(p.type))
			.map((p) => p.value)
			.join('.');
		return `${datePart} ${part('hour')}:${part('minute')}:${part('second')}`;
	};

	/** 'lastSeen' -> 'Last Seen', 'channel0average' -> 'Channel 0 average' etc. */
	const formatObjectKeys = (object) => {
		const formatted = {};
		for (const key in object) {
			const title = key
				.replace(/([a-z])([A-Z])/g, '$1 $2') // lowercase followed by uppercase
				.replace(/([a-zA-Z])([0-9]+)/g, '$1 $2') // letters followed by numbers
				.replace(/([0-9]+)([a-zA-Z])/g, '$1 $2') // numbers followed by letters
				.replace(/^./, (char) => char.toUpperCase());
			formatted[title] = object[key];
		}
		return formatted;
	};

	const flattenChannelAverages = (backgroundRSSI) => {
		const flattened = {};
		for (const key in backgroundRSSI) {
			if (key.startsWith('channel')) {
				flattened[`${key}average`] = backgroundRSSI[key].average;
			} else {
				flattened[key] = backgroundRSSI[key];
			}
		}
		return flattened;
	};

	const highlightJSONLine = (match, indent, key, value, end) => {
		let result = indent || '';
		if (key) result += `<span class=zwjs-json-key>${key}</span>`;
		if (value)
			result += `${value[0] === '"' ? '<span class=zwjs-json-string>' : '<span class=zwjs-json-value>'}${value}</span>`;
		return result + (end || '');
	};

	const prettyPrintJSON = (object) =>
		(JSON.stringify(object, null, 3) ?? '')
			.replace(/&/g, '&amp;')
			.replace(/\\"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/^( *)("[\w]+": )?("[^"]*"|[\w.+-]*)?([,[{])?$/gm, highlightJSONLine);

	const toSecurityClassList = (classIds) =>
		classIds.map((classId) => ({ classId, className: SECURITY_CLASSES[classId]?.name }));

	const parseOptionalInt = (value) => {
		const number = parseInt(value, 10);
		return Number.isNaN(number) ? undefined : number;
	};

	// ---- selection guards ----

	const requireSelectedNode = () => {
		if (!selectedNode) throw new Error('No Z-Wave node is currently selected');
		return selectedNode;
	};

	const getControllerData = () => $('#zwjs-controller-info').data('info');

	const requireControllerHomeId = () => {
		const homeId = getControllerData()?.homeId;
		if (!homeId) throw new Error('Controller information is not available');
		return homeId;
	};

	/*
	 * 3. COMMON UI
	 */

	const ZWJSAlert = (message) => {
		$('<div>')
			.text(message)
			.dialog({
				modal: true,
				title: 'Alert',
				buttons: {
					OK() {
						$(this).dialog('close');
					}
				},
				close() {
					$(this).dialog('destroy').remove();
				}
			});
	};

	// Resolves true for OK, false for Cancel or closing the dialog.
	const confirmAction = (message) =>
		new Promise((resolve) => {
			$('<div>')
				.text(message)
				.dialog({
					modal: true,
					title: 'Confirm',
					buttons: {
						OK() {
							resolve(true);
							$(this).dialog('close');
						},
						Cancel() {
							resolve(false);
							$(this).dialog('close');
						}
					},
					close() {
						resolve(false); // no effect if a button already answered
						$(this).dialog('destroy').remove();
					}
				});
		});

	const reportError = (error) => ZWJSAlert(toError(error).message);

	/** Runs `action`, alerting instead of throwing if it fails. Resolves true if it succeeded. */
	const attempt = async (action) => {
		try {
			await action();
			return true;
		} catch (error) {
			reportError(error);
			return false;
		}
	};

	const disableButton = (button) => {
		const $button = $(button);
		if (!$button.prop('disabled')) $button.data('original_text', $button.text());
		$button.text('Please wait...').prop('disabled', true);
	};

	const enableButton = (button) => {
		const $button = $(button);
		const originalText = $button.data('original_text');
		if (originalText !== undefined) $button.text(originalText);
		$button.prop('disabled', false);
	};

	/** Disables `button` while `action` runs, alerting if it fails. Resolves true if the action succeeded. */
	const runButtonAction = async (button, action) => {
		disableButton(button);
		const succeeded = await attempt(action);
		enableButton(button);
		return succeeded;
	};

	const resizePanels = () => panels?.resize($('#zwjs-sidebar').height());

	const ZoomUI = (delta) => {
		const sidebar = $('#zwjs-sidebar');
		if (delta === undefined) {
			sidebar.css('zoom', '1.0');
		} else {
			const current = parseFloat(sidebar.css('zoom')) || 1;
			const next = Math.min(Math.max(current + delta, 0.1), 2.0);
			sidebar.css('zoom', parseFloat(next.toFixed(2)));
		}
		resizePanels();
	};

	/** Opens a management tray and clicks its default menu entry once rendered. */
	const openTray = ({ kind, title, template, state, width = 900 }) => {
		RED.tray.show({
			width,
			title,
			buttons: [{ id: 'zwjs-tray-close', text: 'Close', click: closeTray }],
			open: (tray) => {
				trayKind = kind;
				tray.find('.red-ui-tray-body, .editor-tray-body').append(template(state));
				setTimeout(() => {
					const defaultMenuItem = $('.zwjs-tray-menu > div[default]')[0];
					defaultMenuItem?.onclick?.call(defaultMenuItem);
				}, 250);
			}
		});
	};

	const closeTray = () => {
		if (!trayKind) return;

		qrScanner?.destroy();
		qrScanner = undefined;

		codeEditor?.destroy();
		codeEditor = undefined;

		// Only the controller trays can leave an inclusion / exclusion / network join in progress.
		if (trayKind === 'controller' && networkId) {
			['stopInclusion', 'stopExclusion', 'stopJoiningNetwork', 'stopLeavingNetwork'].forEach((method) =>
				raw.get('CONTROLLER', method).catch(() => {})
			);
		}

		RED.tray.close();
		trayKind = undefined;
	};

	/*
	 * 4. INITIALISATION
	 */

	const registerHandlebars = () => {
		$.get('resources/node-red-contrib-zwave-js/UITab/ValueEditors.html', (html) => {
			Handlebars.registerPartial('ValueEditors', html);
		});

		Handlebars.registerHelper('json', (object) => JSON.stringify(object, undefined, 2));
		Handlebars.registerHelper('encode', (object) => encodeObject(object));
		Handlebars.registerHelper('pretty', (object) => prettyPrintJSON(object));

		Handlebars.registerHelper('eq', function (actual, expected, options) {
			return actual === expected ? options.fn(this) : options.inverse(this);
		});

		// Renders the block as a <select> body with the option matching `value` pre-selected.
		Handlebars.registerHelper('select', function (value, options) {
			const $select = $('<select />').html(options.fn(this));
			$select.find(`[value="${value}"]`).attr({ selected: 'selected' });
			return $select.html();
		});

		// Renders an ace JSON editor holding the block's content; it is created once the tray is in the DOM.
		Handlebars.registerHelper('editor', function (id, options) {
			setTimeout(() => {
				codeEditor?.destroy();
				codeEditor = RED.editor.createEditor({ id, mode: 'ace/mode/json', value: options.fn(this) });
			}, 175);
			return new Handlebars.SafeString(
				`<div style="height: 250px; min-height:150px;" class="node-text-editor" id="${id}"></div>`
			);
		});
	};

	const compileTemplates = () => {
		const compile = (id) => Handlebars.compile($(`#${id}`).html());
		templates.sidePanel = compile('ZWJS_TPL_SidePanel');
		templates.controller = compile('ZWJS_TPL_Tray-Controller');
		templates.controllerRecovery = compile('ZWJS_TPL_Tray-Controller-Recover');
		templates.node = compile('ZWJS_TPL_Tray-Node');
		templates.value = compile('ZWJS_TPL_Tray-Node-Value');
	};

	const init = () => {
		registerHandlebars();
		compileTemplates();

		RED.sidebar.addTab({
			id: 'zwave-js',
			label: ' ZWave JS',
			name: 'Z-Wave JS',
			content: templates.sidePanel({}),
			enableOnEdit: true,
			iconClass: 'fa fa-wifi',
			onchange: () => setTimeout(resizePanels, 0)
		});

		$('#zwjs-node-list').treeList({ data: [] });
		$('#zwjs-node-list').on('treelistselect', nodeSelected);
		$('#zwjs-cc-list').treeList({ data: [] });
		$('#zwjs-cc-list').on('treelistselect', valueSelected);

		panels = RED.panels.create({ container: $('#zwjs-panel-stack') });
		panels.ratio(0.3);

		RED.events.on('sidebar:resize', resizePanels);
		$(window).on('resize focus', resizePanels);

		loadNetworks();
		RED.comms.subscribe('zwave-js/ui/global/addnetwork', (topic, network) => addNetwork(network));
		RED.comms.subscribe('zwave-js/ui/global/removenetwork', (topic, network) => removeNetwork(network));

		$('#zwjs-sidebar a[data-tip]').each(function () {
			RED.popover.tooltip($(this), $(this).data('tip'));
		});
	};

	/*
	 * 5. NETWORK SELECTION, NODE LIST AND NODE SELECTION
	 */

	// ---- networks ----

	const loadNetworks = async () => {
		try {
			const result = await request('GET', 'zwave-js/ui/global/networks');
			if (!result.callSuccess) return;
			const select = $('#zwjs-network');
			Object.entries(result.response).forEach(([id, name]) => select.append(new Option(name, id)));
			selectFirstNetwork();
		} catch (error) {
			console.warn('Z-Wave JS: unable to list networks', error);
		}
	};

	const addNetwork = (network) => {
		const select = $('#zwjs-network');
		const exists = select.children().filter((index, option) => option.value === network.id).length > 0;
		if (!exists) select.append(new Option(network.name, network.id));
		selectFirstNetwork();
	};

	const removeNetwork = (network) => {
		const select = $('#zwjs-network');
		if (select.val() === network.id) {
			setSubscription(false, network.id);
			clearSelection(true);
		}
		select
			.children()
			.filter((index, option) => option.value === network.id)
			.remove();
		selectFirstNetwork();
	};

	// The select holds a placeholder plus one option per network: with a single network, pick it and hide the select.
	const selectFirstNetwork = () => {
		const select = $('#zwjs-network');
		const options = select.children();

		if (options.length === 2) {
			select.val(options.eq(1).val());
			NetworkSelected();
		}
		select.parent().toggle(options.length >= 3);
	};

	// Polls until the runtime has a status for the network (or the user picks another network).
	const waitForNetworkStatus = async (targetNetworkId) => {
		while (networkId === targetNetworkId) {
			const result = await raw.getPath('status');
			if (result?.response !== undefined) return result.response;
			await delay(500);
		}
		return undefined;
	};

	const applyNetworkStatus = (status) => {
		$('#zwjs-controller-status').text(status);
		if (status === STATUS_BOOTLOADER) {
			handleBootloader();
			return;
		}
		bootloaderMode = false;
		RefreshNodes('NetworkSelected');
	};

	const NetworkSelected = async () => {
		if (networkId) setSubscription(false, networkId);

		const selected = $('#zwjs-network').val();
		clearSelection(true);
		if (selected === 'NONE') return;

		$('#zwjs-controller-info').text('--');
		$('#zwjs-controller-status').text('Waiting for Network Status Report...');
		networkId = selected;
		setSubscription(true);

		try {
			const status = await waitForNetworkStatus(selected);
			if (networkId === selected && status !== undefined) applyNetworkStatus(status);
		} catch (error) {
			reportError(error);
		}
	};

	const showRecovery = () =>
		openTray({
			kind: 'controller',
			title: 'ZWave JS Controller Management (Recovery)',
			template: templates.controllerRecovery,
			state: { Network: $('#zwjs-controller-info').text(), Status: $('#zwjs-controller-status').text() }
		});

	const clearSelection = (includeNetwork) => {
		$('#zwjs-node-info-id').text('--');
		$('#zwjs-node-info').text('No Node Selected');
		$('#zwjs-endpoint-list').empty();
		$('#zwjs-node-status').empty();
		$('#zwjs-cc-list').treeList('empty');
		$('#zwjs-node-list').treeList('empty');
		selectedNode = undefined;

		if (includeNetwork) {
			$('#zwjs-controller-info').text('No Network Selected');
			$('#zwjs-controller-status').empty();
			networkId = undefined;
		}
	};

	// ---- node tree ----

	/** The tree group a node is filed under, for the current grouping mode. */
	const getGroupLabel = (nodeLocation) => (groupMode.byLocation ? nodeLocation?.trim() || NO_LOCATION : ALL_NODES);

	const getGroupId = (label) => `zwjs-node-list-entry-location-${label.replace(/ /g, '-')}`;

	const getLocationInitials = (location) =>
		location
			.split(/\s+/)
			.map((word) => word[0] || '')
			.join('')
			.toUpperCase();

	const NODE_STATE_ICONS = ['interview', 'status', 'power', 'security'];

	const createGroupLabel = (label) => {
		const element = $('<div>').attr('zwjs-node-group', '');
		element.append($('<span class="zwjs-node-id">').text(getLocationInitials(label)));
		element.append(' ');
		element.append(
			'<i aria-hidden="true" class="zwjs-group-status fa fa-exclamation-triangle zwjs-state-amber" style="display:none"></i>'
		);
		element.append(document.createTextNode(` ${label} `));

		const stateIcons = $('<span>').attr('group', '').addClass('zwjs-node-state-group');
		['Int', 'Sta', 'Pow', 'Sec'].forEach((text) => stateIcons.append($('<i aria-hidden="true">').text(text)));
		return element.append(stateIcons);
	};

	const createNodeItem = (node) => {
		const element = $('<div>');
		element.append($('<span class="zwjs-node-id">').text(node.nodeId));
		element.append(
			$('<span>')
				.attr('id', `zwjs-node-name-${node.nodeId}`)
				.text(node.nodeName || 'No Name')
		);

		const stateIcons = $('<span>').addClass('zwjs-node-state-group');
		NODE_STATE_ICONS.forEach((kind) =>
			stateIcons.append(`<i id="zwjs-node-state-${kind}-${node.nodeId}" aria-hidden="true"></i>`)
		);
		element.append(stateIcons);
		renderNodeIconState(node, element); // draw now: the row itself is only added to the DOM later

		return { id: `zwjs-node-list-entry-${node.nodeId}`, element, nodeData: node };
	};

	const buildNodeTree = (nodes) => {
		const groups = new Map(); // Map keeps groups in the order they were first seen
		nodes.forEach((node) => {
			const label = getGroupLabel(node.nodeLocation);
			if (!groups.has(label)) groups.set(label, []);
			groups.get(label).push(node);
		});

		return [...groups].map(([label, groupNodes]) => ({
			id: getGroupId(label),
			element: createGroupLabel(label),
			children: groupNodes.map(createNodeItem),
			expanded: !groupMode.byLocation || groupMode.expanded
		}));
	};

	const findTreeItem = (nodeId) => {
		for (const group of $('#zwjs-node-list').treeList('data')) {
			const item = group.children?.find((child) => child.nodeData?.nodeId === nodeId);
			if (item) return item;
		}
		return undefined;
	};

	const updateControllerSummary = (controller) => {
		if (!controller) throw new Error('The controller node was not found');
		const { manufacturer, label } = controller.deviceConfig ?? {};
		$('#zwjs-controller-info').text(`${manufacturer} | ${label} | v${controller.firmwareVersion}`);
		$('#zwjs-controller-info').data('info', controller);
	};

	// Other controllers (Z-Wave Plus role types 0-3) are not listed in the tree.
	const isListedNode = (node) =>
		!node.isControllerNode && (node.zwavePlusRoleType === undefined || node.zwavePlusRoleType > 3);

	const renderNodeTree = (nodes) => {
		const treeData = buildNodeTree(nodes);
		$('#zwjs-node-list').treeList('data', treeData);
	};

	const prepareNodeContextForRefresh = (reason, nodeId) => {
		if (NODE_CONTEXT_RESET_REASONS.has(reason)) {
			clearSelection();
			closeTray();
		} else if (reason === 'NodeRemoved' && selectedNode?.nodeId === nodeId) {
			clearSelection();
		}
	};

	const RefreshNodes = async (reason, nodeId) => {
		if (!networkId) return;

		prepareNodeContextForRefresh(reason, nodeId);

		try {
			const allNodes = await fetchNodes();
			updateControllerSummary(allNodes.find((node) => node.isControllerNode));
			renderNodeTree(allNodes.filter(isListedNode));
		} catch (error) {
			reportError(error);
		} finally {
			renderGroupIconState();
		}
	};

	const NodeCollapseToggle = (mode, anchor) => {
		const nextMode = GROUP_MODES[mode];
		if (!nextMode) return;

		$('i.zwjs-button-group').removeAttr('selected');
		$(anchor).find('i.zwjs-button-group').attr('selected', '');
		groupMode = { ...nextMode };
		RefreshNodes('Sorted');
	};

	// ---- node state icons ----

	const STATE_ICON_SELECTOR =
		'span.zwjs-node-state-group i[id^="zwjs-node-state-status"], span.zwjs-node-state-group i[id^="zwjs-node-state-power"]';

	// 0 = all good, 1 = something needs attention (amber), 2 = something is wrong (red)
	const getGroupSeverity = (group) => {
		let severity = 0;
		for (const child of group.children) {
			if (!child.element) continue;
			const icons = $(child.element).find(STATE_ICON_SELECTOR);
			if (icons.hasClass('zwjs-state-red')) return 2;
			if (icons.hasClass('zwjs-state-amber')) severity = 1;
		}
		return severity;
	};

	let groupIconTimer;

	// Debounced: node events arrive in bursts and each refresh walks the whole tree.
	const renderGroupIconState = () => {
		clearTimeout(groupIconTimer);
		groupIconTimer = setTimeout(() => {
			$('#zwjs-node-list')
				.treeList('data')
				.forEach((group) => {
					if (!group.children) return;
					const severity = getGroupSeverity(group);
					const indicator = $(group.element).find('i.zwjs-group-status');
					indicator.hide().removeClass('zwjs-state-amber zwjs-state-red');
					if (severity) indicator.show().addClass(severity === 2 ? 'zwjs-state-red' : 'zwjs-state-amber');
				});
		}, 150);
	};

	// RED.popover.tooltip stacks handlers if called repeatedly, so update an existing tooltip instead.
	const setTooltip = (icon, text) => {
		const existing = icon.data('zwjs-tooltip');
		if (existing?.setContent) {
			existing.setContent(text);
		} else {
			icon.data('zwjs-tooltip', RED.popover.tooltip(icon, text));
		}
	};

	const renderInterviewIcon = (node, icon) => {
		if (node.interviewStage !== 'Complete') {
			icon.addClass(['fa', 'fa-handshake-o', 'zwjs-state-amber']);
			setTooltip(icon, 'Pending Interview');
		} else if (!node.deviceConfig) {
			icon.addClass(['fa', 'fa-check', 'zwjs-state-amber']);
			setTooltip(icon, 'Fully Interviewed, but no device configuration was found');
		} else {
			icon.addClass(['fa', 'fa-check', 'zwjs-state-green']);
			setTooltip(icon, 'Fully Interviewed');
		}
	};

	// status -> [icon, colour, tooltip]
	const AVAILABILITY_STATES = {
		Alive: ['fa-sun-o', 'zwjs-state-green', 'Alive/Awake'],
		Awake: ['fa-sun-o', 'zwjs-state-green', 'Alive/Awake'],
		Asleep: ['fa-moon-o', 'zwjs-state-darkgray', 'Asleep'],
		Dead: ['fa-exclamation-triangle', 'zwjs-state-red', 'Dead/Not Responding'],
		Unknown: ['fa-question-circle', 'zwjs-state-amber', 'Unknown']
	};

	const renderAvailabilityIcon = (node, icon) => {
		const seenAt = node.lastSeen === undefined ? undefined : formatDateTime(node.lastSeen);
		const isStale =
			node.status !== 'Dead' &&
			node.status !== 'Unknown' &&
			node.lastSeen !== undefined &&
			Date.now() - node.lastSeen > STALE_NODE_AGE_MS;

		if (isStale) {
			icon.addClass(['fa', 'fa-question-circle', 'zwjs-state-amber']);
			setTooltip(icon, `${seenAt} : Seen +7 days ago`);
			return;
		}

		const state = AVAILABILITY_STATES[node.status];
		if (!state) return;
		const [iconClass, colourClass, description] = state;
		icon.addClass(['fa', iconClass, colourClass]);
		setTooltip(icon, seenAt ? `${seenAt} : ${description}` : description);
	};

	const getBatteryIcon = (level) => {
		if (level <= 10) return 'fa-battery-empty';
		if (level <= 25) return 'fa-battery-quarter';
		if (level <= 75) return 'fa-battery-half';
		if (level <= 85) return 'fa-battery-three-quarters';
		return 'fa-battery-full';
	};

	// The node's own "recharge or replace" report wins over the raw level when it has one.
	const getBatteryColour = ({ level, rechargeOrReplace }) => {
		if (rechargeOrReplace === 1) return 'zwjs-state-amber';
		if (rechargeOrReplace === 2) return 'zwjs-state-red';
		if (rechargeOrReplace !== undefined) return 'zwjs-state-green';
		if (level <= 10) return 'zwjs-state-red';
		if (level <= 25) return 'zwjs-state-amber';
		return 'zwjs-state-green';
	};

	const renderPowerIcon = (node, icon) => {
		const powerSource = node.powerSource;
		if (!powerSource) return;

		if (powerSource.type === 'mains') {
			icon.addClass(['fa', 'fa-plug', 'zwjs-state-green']);
			setTooltip(icon, 'Mains Powered');
			return;
		}

		icon.addClass(['fa', getBatteryIcon(powerSource.level), getBatteryColour(powerSource)]);
		setTooltip(icon, `Battery Powered: (${powerSource.level}%)`);
	};

	const renderSecurityIcon = (node, icon) => {
		const securityClass = node.highestSecurityClass;
		const isS2 = [0, 1, 2].includes(securityClass);
		const isS0 = securityClass === 7;
		const colour = isS2 ? 'zwjs-state-green' : isS0 ? 'zwjs-state-darkblue' : 'zwjs-state-darkgray';
		icon.addClass(['fa', isS2 || isS0 ? 'fa-lock' : 'fa-unlock-alt', colour]);
		setTooltip(icon, SECURITY_CLASSES[securityClass]?.label || 'No Security');
	};

	/**
	 * Draws a node's state icons into its tree item element.
	 *
	 * treeList builds child rows asynchronously (in slices, after the data is set), so the row may not be in the
	 * document yet. It does reuse the element we hand it, though, so the icons are drawn onto that element rather
	 * than looked up in the document.
	 */
	const renderNodeIconState = (node, element = findTreeItem(node.nodeId)?.element) => {
		if (!element) return; // node is not in the tree

		const icons = {};
		NODE_STATE_ICONS.forEach((kind) => (icons[kind] = $(element).find(`#zwjs-node-state-${kind}-${node.nodeId}`)));
		if (!icons.interview.length) return;

		Object.values(icons).forEach((icon) => icon.removeClass());
		renderInterviewIcon(node, icons.interview);
		renderAvailabilityIcon(node, icons.status);
		renderPowerIcon(node, icons.power);
		renderSecurityIcon(node, icons.security);
	};

	// ---- node selection ----

	const getSelectedNodeData = () => {
		const { nodeId } = requireSelectedNode();
		const item = findTreeItem(nodeId);
		if (!item?.nodeData) throw new Error(`Node ${nodeId} is no longer present in the sidebar`);
		return item.nodeData;
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
		$('#zwjs-node-info').text(
			node.interviewStage === 'Complete'
				? `${node.deviceConfig.manufacturer} | ${node.deviceConfig.label} | v${node.firmwareVersion}`
				: `Node Interview Stage : ${node.interviewStage}`
		);
	};

	const groupValuesByEndpoint = (values) =>
		values.reduce((groups, value) => {
			(groups[value.valueId.endpoint] ||= []).push(value);
			return groups;
		}, {});

	const resizeForEndpointCount = (endpointCount) => {
		const hasMultipleEndpoints = endpointCount >= 2;
		$('#zwjs-endpoint-list').toggle(hasMultipleEndpoints);
		$('#zwjs-cc-list').css({ height: hasMultipleEndpoints ? 'calc(100% - 200px)' : 'calc(100% - 165px)' });
		resizePanels();
	};

	const selectEndpoint = (endpoint, endpointGroups) => {
		listCommandClasses(endpointGroups[endpoint]);
		$('#zwjs-endpoint-list > div').removeAttr('selected');
		$(`#zwjs-endpoint-list > div[data-endpoint="${endpoint}"]`).attr('selected', 'selected');
	};

	const renderEndpointButtons = (endpointGroups) => {
		const endpointIds = Object.keys(endpointGroups);
		resizeForEndpointCount(endpointIds.length);
		if (!endpointIds.length) return;

		endpointIds.forEach((endpoint) => {
			$('<div>')
				.attr('data-endpoint', endpoint)
				.text(endpoint === '0' ? 'Root' : `EP${endpoint}`)
				.on('click', () => selectEndpoint(endpoint, endpointGroups))
				.appendTo('#zwjs-endpoint-list');
		});

		selectEndpoint(endpointIds[0], endpointGroups); // keys are numeric, so this is the Root endpoint when present
	};

	const nodeSelected = async (event, item) => {
		if (!item?.nodeData) return;

		const node = ensureDeviceConfig(item.nodeData);
		selectedNode = node;
		selectedNodeValues = {};
		$('#zwjs-endpoint-list').empty();
		$('#zwjs-cc-list').treeList('empty');
		closeTray();
		renderSelectedNodeSummary(node);

		try {
			const valueDB = await runtime.post('DRIVER', 'getValueDB', [node.nodeId]);
			if (selectedNode !== node) return; // another node was selected while this one was loading
			renderEndpointButtons(groupValuesByEndpoint(valueDB[0]?.values || []));
		} catch (error) {
			reportError(error);
		}
	};

	/*
	 * 6. COMMAND CLASSES AND VALUES
	 */

	// djb2 hash of node id + value id: a stable DOM id for a value, so live updates can find its element.
	const getValueUpdateHash = (valueId) => {
		const text = `${selectedNode.nodeId}${JSON.stringify(valueId)}`;
		let hash = 5381;
		for (let i = 0; i < text.length; i++) {
			hash = (hash << 5) + hash + text.charCodeAt(i);
		}
		return (hash >>> 0).toString(16);
	};

	const formatDisplayValue = (value, metadata) => {
		if (value === undefined || value === null) return '';
		if (typeof value === 'object' && !Array.isArray(value)) return '(Complex)';
		const state = metadata?.states?.[value];
		if (state) return state;
		return metadata?.unit ? `${value} (${metadata.unit})` : value;
	};

	// The element showing a value's current text. The id is kept for templates; updates use the reference instead.
	const createCurrentValueElement = (valueInfo) => {
		if (valueInfo.currentValue === undefined) return undefined;
		return $('<span class="zwjs-cc-value">')
			.attr('id', `zwjs-value-${getValueUpdateHash(valueInfo.valueId)}`)
			.text(formatDisplayValue(valueInfo.currentValue, valueInfo.metadata));
	};

	const formatValueProperty = ({ property, propertyKey }) => {
		const formatPart = (part) => (typeof part === 'number' ? formatHex(part) : part);
		let text = formatPart(property);
		if (propertyKey !== undefined && propertyKey !== null) text += ` / ${formatPart(propertyKey)}`;
		return text;
	};

	// ---- value tray state ----

	const stripValueIdNames = (valueId) => {
		const clean = { ...valueId };
		delete clean.commandClassName;
		delete clean.propertyName;
		delete clean.propertyKeyName;
		return clean;
	};

	// Example Node-RED messages for reading / writing this value, shown in the value tray.
	const buildValueExamples = (valueInfo) => {
		const { metadata, currentValue } = valueInfo;
		const valueId = stripValueIdNames(valueInfo.valueId);
		const examples = {
			valueLabel: metadata.label,
			nocmd: {
				payload: {
					cmd: { api: 'VALUE', method: metadata.writeable ? 'setValue | getValue' : 'getValue' },
					cmdProperties: { nodeId: selectedNode.nodeId, valueId: { ...valueId } }
				}
			},
			cmd: { topic: selectedNode.nodeId, valueId: { ...valueId } }
		};

		if (metadata.writeable) {
			examples.nocmd.payload.cmdProperties.value = currentValue;
			examples.cmd.payload = currentValue;
		}

		if (metadata.valueChangeOptions) {
			examples.cmd.options = {};
			examples.nocmd.payload.cmdProperties.setValueOptions = {};
			metadata.valueChangeOptions.forEach((option) => {
				examples.cmd.options[option] = SET_VALUE_OPTION_EXAMPLES[option];
				examples.nocmd.payload.cmdProperties.setValueOptions[option] = SET_VALUE_OPTION_EXAMPLES[option];
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

	// ---- opening a value: small dialog for quick edits, full tray otherwise ----

	const showMiniValueEditor = (state, useMobileWidth) => {
		const dialog = $('<div>').css({ padding: 10, wordWrap: 'break-word' });
		dialog.append('<div id="zwjs-mini-content"></div>');
		miniEditorDialog = dialog.dialog({
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
				miniEditorDialog = undefined;
			},
			open() {
				closeTray();
				RenderAdvanced('ZWJS_TPL_Tray-Node-Value-Current', undefined, state.editInfo, '#zwjs-mini-content');
			}
		});
	};

	const openValueManagement = (event, valueInfo) => {
		viewingValueId = valueInfo.valueId;
		const state = buildValueManagementState(valueInfo);
		const useMobileWidth = $(window).width() < 1024;
		const clickedCurrentValue = $(event.originalEvent?.target).closest('.zwjs-cc-value').length > 0;

		if (useMobileWidth || clickedCurrentValue) {
			showMiniValueEditor(state, useMobileWidth);
			return;
		}

		closeTray();
		openTray({ kind: 'value', width: 700, title: 'Value Management', template: templates.value, state });
	};

	const valueSelected = (event, item) => {
		if (!item || item.parent === true || !item.valueInfo) return;
		openValueManagement(event, item.valueInfo);
	};

	// ---- command class list ----

	const createValueItem = (value) => {
		const hash = getValueUpdateHash(value.valueId);
		const valueInfo = { metadata: value.metadata, valueId: value.valueId, currentValue: value.currentValue };
		valueInfo.valueElement = createCurrentValueElement(valueInfo);
		selectedNodeValues[hash] = valueInfo;

		// treeList reuses this element when it builds the row (asynchronously), so live updates can target
		// valueInfo.valueElement without the row being in the document yet.
		const element = $('<div>')
			.css({ width: '100%', 'margin-right': '30px' })
			.append(document.createTextNode(`${value.metadata.label || value.valueId.property} `));
		if (valueInfo.valueElement) element.append(valueInfo.valueElement);

		return {
			element,
			icon: value.metadata.writeable ? 'fa fa-pencil' : '',
			parent: false,
			valueInfo
		};
	};

	const buildCommandClassTree = (values) => {
		const byCommandClass = new Map();
		values.forEach((value) => {
			const commandClass = value.valueId.commandClass;
			if (!byCommandClass.has(commandClass)) byCommandClass.set(commandClass, []);
			byCommandClass.get(commandClass).push(value);
		});

		return [...byCommandClass]
			.sort(([a], [b]) => a - b)
			.map(([commandClass, group]) => ({
				element: `<div><span class="zwjs-cc-id">${formatHex(commandClass)}</span> - ${escapeHtml(group[0].valueId.commandClassName)}</div>`,
				parent: true,
				children: group.map(createValueItem)
			}));
	};

	const listCommandClasses = (values) => {
		const tree = $('#zwjs-cc-list');
		tree.treeList('empty');
		tree.treeList('data', buildCommandClassTree(values));
	};

	// ---- editing a value ----

	// Reads the new value from whichever editor the value tray rendered.
	const readEditedValue = (usingDefinedValue) => {
		if (codeEditor) return JSON.parse(codeEditor.getValue());

		const editor = $('#zwjs-cc-value-new');
		if (usingDefinedValue) {
			const value = parseInt($('#zwjs-cc-value-new-defined').val(), 10);
			editor.val(value);
			return value;
		}

		if (editor.is('select')) return parseInt(editor.val(), 10);
		if (!editor.is('input')) return undefined;

		switch (editor.attr('type')) {
			case 'number': {
				const value = parseFloat(editor.val());
				if (Number.isNaN(value)) throw new Error('Enter a valid number');
				return value;
			}
			case 'checkbox':
				return editor.prop('checked');
			case 'color':
				return editor.val().substring(1);
			default:
				return undefined;
		}
	};

	const showValueUpdateSuccess = (button) => {
		$(button).css({ backgroundColor: 'green' });
		setTimeout(() => $(button).css({ backgroundColor: '' }), 1500);

		if (miniEditorDialog) {
			miniEditorDialog.dialog('destroy');
			miniEditorDialog = undefined;
		}
	};

	const UpdateValue = (button, encodedValueId, usingDefinedValue) =>
		runButtonAction(button, async () => {
			const valueId = decodeObject(encodedValueId);
			const value = readEditedValue(usingDefinedValue);
			const result = await runtime.post('VALUE', 'setValue', { nodeId: requireSelectedNode().nodeId, valueId, value });

			const failure = SET_VALUE_FAILURES[result.status];
			if (failure) throw new Error(failure);
			showValueUpdateSuccess(button);
		});

	/*
	 * 7. MANAGEMENT TRAYS, PANEL RENDERING AND THE TOPOLOGY MAP
	 */

	// ---- management trays ----

	const prepareControllerData = (controller) => {
		const backgroundRSSI = controller.statistics?.backgroundRSSI;
		controller.backgroundRSSI = backgroundRSSI ? flattenChannelAverages(backgroundRSSI) : {};
		if (controller.statistics) delete controller.statistics.backgroundRSSI;
		$('#zwjs-controller-info').data('info', controller);
	};

	const ShowNetworkManagement = async () => {
		if (!networkId) return;
		closeTray();
		if (bootloaderMode) return showRecovery();

		await attempt(async () => {
			const controller = (await fetchNodes()).find((node) => node.isControllerNode);
			if (!controller) throw new Error('The controller node was not found');
			prepareControllerData(controller);
			openTray({
				kind: 'controller',
				title: 'ZWave JS Controller Management',
				template: templates.controller,
				state: { Network: $('#zwjs-controller-info').text(), Status: $('#zwjs-controller-status').text() }
			});
		});
	};

	// Replaces the selected node's tree data with fresh data from the controller.
	const refreshSelectedNodeData = async () => {
		const { nodeId } = requireSelectedNode();
		const node = (await fetchNodes()).find((candidate) => candidate.nodeId === nodeId);
		if (!node) throw new Error(`Node ${nodeId} was not found`);

		if (node.statistics) delete node.statistics.lwr; // shown on the topology map instead
		const item = findTreeItem(nodeId);
		if (item) item.nodeData = node;
	};

	const ShowNodeManagement = async () => {
		if (!selectedNode) return;
		closeTray();

		await attempt(async () => {
			await refreshSelectedNodeData();
			openTray({
				kind: 'node',
				title: 'ZWave JS Node Management',
				template: templates.node,
				state: {
					NodeID: $('#zwjs-node-info-id').text(),
					Status: $('#zwjs-node-status').text(),
					NodeInfo: $('#zwjs-node-info').text()
				}
			});
		});
	};

	const InterviewCurrentNode = async () => {
		if (!selectedNode) return;
		const { nodeId } = selectedNode;
		if (!(await confirmAction('Are you sure you wish to re-interview this Node?'))) return;
		await attempt(() => runtime.post('NODE', 'refreshInfo', { nodeId }));
	};

	// ---- advanced panels: Handlebars templates rendered into the tray ----

	const advancedTemplates = new Map();

	const getAdvancedTemplate = (templateId) => {
		if (!advancedTemplates.has(templateId)) {
			advancedTemplates.set(templateId, Handlebars.compile($(`#${templateId}`).html()));
		}
		return advancedTemplates.get(templateId);
	};

	/**
	 * `source` is one of: nothing, an object to render as-is, the name of a panel data provider,
	 * or a base64 string produced by the `encode` Handlebars helper.
	 */
	const resolveAdvancedPanelData = async (source) => {
		if (!source) return {};
		if (typeof source === 'object') return source;
		if (typeof source !== 'string') return {};
		return Object.prototype.hasOwnProperty.call(panelDataProviders, source)
			? panelDataProviders[source]()
			: decodeObject(source);
	};

	const RenderAdvanced = async (templateId, target, dataSource, writeTarget) => {
		try {
			const render = getAdvancedTemplate(templateId);
			const data = await resolveAdvancedPanelData(dataSource);
			$(writeTarget || '#zwjs-advanced-content')
				.empty()
				.append(render(data));

			if (target) {
				$('.zwjs-tray-menu div').removeAttr('active');
				$(target).attr('active', '');
			}
		} catch (error) {
			reportError(error);
		}
	};

	// ---- topology map ----

	const idOf = (end) => (typeof end === 'object' ? end.id : end);

	/** `rootId` plus every node routed through it, so they can be released when it is dragged. */
	const collectDescendantIds = (rootId, layoutLinks) => {
		const ids = new Set([rootId]);
		let grew = true;
		while (grew) {
			grew = false;
			layoutLinks.forEach((link) => {
				if (ids.has(idOf(link.source)) && !ids.has(idOf(link.target))) {
					ids.add(idOf(link.target));
					grew = true;
				}
			});
		}
		return ids;
	};

	const createSimulation = (nodes, layoutLinks, width, height, onTick) =>
		ZWJSD3.forceSimulation(nodes)
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
			.on('tick', onTick);

	const getNodeDetailRows = (d) =>
		[
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
		].filter(([, value]) => value !== undefined && value !== '');

	const renderTopologyGraph = (target, nodes, links, layoutLinks) => {
		const container = ZWJSD3.select(target);
		if (container.empty()) return;

		container.selectAll('*').remove();
		container.style('position', 'relative').style('width', '100%').style('height', '100%');

		const element = container.node();
		let width = element.clientWidth || 800;
		let height = element.clientHeight || 500;
		const routeColour = ZWJSD3.scaleOrdinal(ZWJSD3.schemeTableau10);
		const nodesById = new Map(nodes.map((node) => [node.id, node]));

		links.forEach((link) => {
			link.source = typeof link.source === 'object' ? link.source : nodesById.get(link.source);
			link.target = typeof link.target === 'object' ? link.target : nodesById.get(link.target);
		});

		const details = container
			.append('div')
			.attr(
				'style',
				'display:none;position:absolute;z-index:10;top:10px;right:10px;min-width:220px;padding:10px;' +
					'background:#fff;border:1px solid #aaa;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.2);font-size:12px'
			);

		const svg = container
			.append('svg')
			.attr('width', '100%')
			.attr('height', '100%')
			.attr('viewBox', [0, 0, width, height]);
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

		const linkSelection = graph
			.append('g')
			.selectAll('line')
			.data(links)
			.join('line')
			.attr('stroke', (d) => (d.direct ? '#28a745' : routeColour(d.routeId)))
			.attr('stroke-width', 2)
			.attr('marker-end', (d) => (d.destination ? 'url(#zwjs-d3-arrow)' : null));

		svg.on('click', () => {
			details.style('display', 'none');
			linkSelection.attr('opacity', 1);
		});

		const nodeSelection = graph
			.append('g')
			.selectAll('g')
			.data(nodes)
			.join('g')
			.style('cursor', 'grab')
			.on('click', (event, d) => {
				event.stopPropagation();
				// Highlight the route to the clicked node (the controller has none).
				linkSelection.attr('opacity', (link) => (d.type === 'controller' || link.routeId === d.id ? 1 : 0.15));

				const title = d.type === 'controller' ? `Controller - Node ${d.id}` : `Node ${d.id} - ${d.name}`;
				const rows = getNodeDetailRows(d)
					.map(([label, value]) => `<div><strong>${label}:</strong> ${escapeHtml(value)}</div>`)
					.join('');
				details
					.html(`<div style="font-weight:bold;font-size:14px;margin-bottom:8px">${escapeHtml(title)}</div>${rows}`)
					.style('display', 'block');
			});

		nodeSelection
			.append('circle')
			.attr('r', 20)
			.attr('fill', (d) => (d.status === 'Dead' ? '#d9534f' : d.type === 'controller' ? '#5b9bd5' : '#fff'))
			.attr('stroke', '#777')
			.attr('stroke-width', 2);

		nodeSelection
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'central')
			.attr('font-family', 'FontAwesome')
			.attr('font-size', 16)
			.attr('fill', (d) => (d.status === 'Dead' ? '#fff' : '#000'))
			.text((d) => (d.type === 'controller' ? '\uf1eb' : d.type === 'mains' ? '\uf1e6' : '\uf240'));

		nodeSelection
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('y', 36)
			.attr('font-size', 12)
			.attr('font-weight', 'bold')
			.text((d) => `${d.id} - ${d.name}`);

		nodeSelection
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('y', 50)
			.attr('font-size', 10)
			.text((d) => d.device);

		const onTick = () => {
			linkSelection.each(function (d) {
				const dx = d.target.x - d.source.x;
				const dy = d.target.y - d.source.y;
				const length = Math.sqrt(dx * dx + dy * dy) || 1;
				// Parallel links between the same pair of nodes are fanned out by `offset`.
				const offsetX = (-dy / length) * d.offset * 4;
				const offsetY = (dx / length) * d.offset * 4;

				ZWJSD3.select(this)
					.attr('x1', d.source.x + offsetX)
					.attr('y1', d.source.y + offsetY)
					.attr('x2', d.target.x + offsetX)
					.attr('y2', d.target.y + offsetY);
			});
			nodeSelection.attr('transform', (d) => `translate(${d.x},${d.y})`);
		};

		const simulation = createSimulation(nodes, layoutLinks, width, height, onTick);

		// Dragging pins a node where it is dropped, and lets the nodes routed through it re-settle around it.
		nodeSelection.call(
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
					onTick();
				})
				.on('end', function (event, d) {
					d.fx = d.x;
					d.fy = d.y;
					ZWJSD3.select(this).style('cursor', 'grab');

					const descendants = collectDescendantIds(d.id, layoutLinks);
					if (descendants.size === 1) return;

					nodes.forEach((node) => {
						if (node !== d && descendants.has(node.id)) {
							node.fx = null;
							node.fy = null;
							node.vx = 0;
							node.vy = 0;
						}
					});
					simulation.alpha(1).restart();
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

	const describeDevice = (node) =>
		`${node.deviceConfig?.manufacturer ?? 'Unknown'} - ${node.deviceConfig?.label ?? 'Unknown'}`;

	const describePower = (powerSource) => {
		if (powerSource?.type !== 'battery') return 'Mains';
		return powerSource.level !== undefined ? `Battery (${powerSource.level}%)` : 'Battery';
	};

	// Gives parallel links between the same two nodes distinct offsets so they do not draw on top of each other.
	const spreadParallelLinks = (links) => {
		const byPair = new Map();
		links.forEach((link) => {
			const key = [link.source, link.target].sort((a, b) => a - b).join('-');
			if (!byPair.has(key)) byPair.set(key, []);
			byPair.get(key).push(link);
		});
		byPair.forEach((group) => {
			group.forEach((link, index) => (link.offset = index - (group.length - 1) / 2));
		});
	};

	/**
	 * Builds the graph from each node's last working route:
	 *   mapLinks    every hop of every route (drawn)
	 *   layoutLinks one link per node, from its last repeater (or the controller), used to lay the graph out
	 */
	const buildTopology = (allNodes) => {
		const controller = allNodes.find((node) => node.isControllerNode);
		if (!controller) throw new Error('The controller node was not found');

		const mapNodes = [
			{
				id: controller.nodeId,
				name: 'Controller',
				type: 'controller',
				device: describeDevice(controller),
				status: controller.status,
				manufacturer: controller.deviceConfig?.manufacturer,
				label: controller.deviceConfig?.label,
				firmwareVersion: controller.firmwareVersion,
				power: 'Mains'
			}
		];
		const mapLinks = [];
		const layoutLinks = [];

		allNodes
			.filter((node) => !node.isControllerNode)
			.forEach((node) => {
				const repeaters = node.statistics?.lwr?.repeaters || [];
				const direct = repeaters.length === 0;
				const route = [controller.nodeId, ...repeaters, node.nodeId];

				mapNodes.push({
					id: node.nodeId,
					name: node.nodeName || 'No Name',
					type: node.powerSource?.type === 'battery' ? 'battery' : 'mains',
					device: describeDevice(node),
					status: node.status,
					location: node.nodeLocation,
					manufacturer: node.deviceConfig?.manufacturer,
					label: node.deviceConfig?.label,
					firmwareVersion: node.firmwareVersion,
					power: describePower(node.powerSource),
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
						direct,
						destination: i === route.length - 2,
						offset: 0
					});
				}

				layoutLinks.push({
					source: direct ? controller.nodeId : repeaters[repeaters.length - 1],
					target: node.nodeId,
					direct
				});
			});

		spreadParallelLinks(mapLinks);
		return { mapNodes, mapLinks, layoutLinks };
	};

	const renderMap = async (target = '#zwjs-d3') => {
		const { mapNodes, mapLinks, layoutLinks } = buildTopology(await fetchNodes());
		renderTopologyGraph(target, mapNodes, mapLinks, layoutLinks);
	};

	const RenderMapDialog = async () => {
		const mapWindow = window.open('', 'ZWaveJSTopology', 'popup=yes,width=1200,height=800,resizable=yes,scrollbars=no');
		if (!mapWindow) {
			ZWJSAlert('The topology map popup was blocked by the browser');
			return;
		}

		mapWindow.document.write(`<!DOCTYPE html>
<html style="width:100%;height:100%;margin:0;padding:0;">
	<head>
		<title>Z-Wave Topology Map</title>
		<link rel="stylesheet" href="resources/node-red-contrib-zwave-js/UITab/styles.css">
		<link rel="stylesheet" href="vendor/font-awesome/css/font-awesome.min.css">
	</head>
	<body style="width:100%;height:100%;margin:0;padding:0;overflow:hidden;">
		<div id="zwjs-d3" style="position:absolute;inset:0;width:100%;height:100%;"></div>
		<div class="zwjs-hint" style="position:absolute;z-index:10;top:10px;left:10px;max-width:500px;">
			The map is based on statistics for each Z-Wave Node, specifically the <strong>Last Working Route(s)</strong> to the Node, from the Controller
		</div>
	</body>
</html>`);
		mapWindow.document.close();

		await attempt(() => renderMap($('#zwjs-d3', mapWindow.document)[0]));
	};

	/*
	 * 8. PANEL DATA PROVIDERS
	 *
	 * Each key is a data source name that templates pass to RenderAdvanced; the function resolves to the
	 * data the panel's Handlebars template renders with.
	 */

	const getFirmwareLicenseMessage = () => {
		if (RED.nodes.node(networkId)?.apiKeys_firmwareUpdateService) return undefined;
		return "<strong>Non-Commercial</strong><br /><br />As no API key has been provided, you're confirming the environment is <strong>Non-Commercial</strong>.<br />An API Key for the Firmware Update Service is required for Commercial installs.";
	};

	// Disables the inclusion strategies the network's configured security keys cannot support.
	const applyInclusionAvailability = () => {
		const config = RED.nodes.node(networkId);
		if (!config) return;

		const hasKey = (key) => (config[key] || '').length >= 32;
		const hasS0 = hasKey('securityKeys_S0_Legacy');
		const hasAllS2 = [
			'securityKeys_S2_AccessControl',
			'securityKeys_S2_Authenticated',
			'securityKeys_S2_Unauthenticated'
		].every(hasKey);

		const radio = (value) => $(`input[type="radio"][name="ZWJS_IS"][value="${value}"]`);
		const disable = (values) =>
			values.forEach((value) => {
				radio(value).attr('disabled', 'disabled').parent().css({ opacity: 0.4 });
			});

		if (!hasAllS2) {
			disable(['0', '4', 'SS']);
			radio('2').prop('checked', true);
		}
		if (!hasS0) disable(['3']);
	};

	const handleQrScan = async (scan) => {
		qrScanner?.stop();
		try {
			const result = await runtime.postPath('s2/parseqr', [scan.data]);
			if (result.isDSK) {
				throw new Error(
					'The QR Code you have scanned, is a DSK (Device Specific Key), it is not a Smart Start QR Code'
				);
			}

			const provisioning = result.qrProvisioningInformation;
			provisioning.manufacturer = result.deviceConfig.manufacturer;
			provisioning.label = result.deviceConfig.label;

			await RenderAdvanced('ZWJS_TPL_PrePro', undefined, {
				QRProvisioningInformation: encodeObject(provisioning),
				DSK: provisioning.dsk,
				DeviceConfig: result.deviceConfig,
				classes: toSecurityClassList(provisioning.requestedSecurityClasses)
			});
		} catch (error) {
			reportError(error);
			qrScanner?.start();
		}
	};

	const startQrScanner = () => {
		const video = $('#zwjs-camera-view')[0];
		if (!video) return;

		qrScanner = new QrScanner(video, handleQrScan, {
			highlightCodeOutline: true,
			highlightScanRegion: true,
			// Scan a centred square covering half of the shortest side of the video.
			calculateScanRegion: () => {
				const size = Math.round(0.5 * Math.min(video.videoWidth, video.videoHeight));
				return {
					x: Math.round((video.videoWidth - size) / 2),
					y: Math.round((video.videoHeight - size) / 2),
					width: size,
					height: size
				};
			}
		});
		qrScanner.start();
	};

	const panelDataProviders = {
		async CheckFUS() {
			const updates = await runtime.post('CONTROLLER', 'getAllAvailableFirmwareUpdates', [
				{ includePrereleases: true }
			]);
			if (!Object.keys(updates).length) throw new Error('No updates available.');
			return { Updates: updates, Message: getFirmwareLicenseMessage() };
		},

		async PrepFUS() {
			return { Message: getFirmwareLicenseMessage() };
		},

		// Deliberately not awaited: the panel has to render first so the progress table exists when this lands.
		GetRRCurrentProgress() {
			raw
				.getPath('rebuildroutesprogress')
				.then((result) => {
					if (result.callSuccess && result.response !== false) {
						commsRebuildRoutesProgress(undefined, { Progress: result.response });
					}
				})
				.catch(() => {});
			return {};
		},

		async ListSplitters() {
			const splitters = RED.nodes
				.filterNodes({ type: 'zwavejs-splitter' })
				.map((node) => ({ name: node.name, id: node.id }));
			const labelParts = [
				viewingValueId.commandClassName,
				viewingValueId.propertyName,
				viewingValueId.propertyKeyName
			].filter(Boolean);
			return {
				splitters,
				label: labelParts.map((part) => part.replace(/ /g, '_').toUpperCase()).join('.'),
				shape: viewingValueId
			};
		},

		async PrepFailed() {
			const nodes = await fetchNodes();
			return { nodes: nodes.filter((node) => node.status === 'Dead') };
		},

		async ControllerInfo() {
			const versions = await runtime.getPath('version');
			return {
				configuration: $('#zwjs-network option:selected').text(),
				serialPort: RED.nodes.node(networkId)?.serialPort,
				...versions,
				...getControllerData()
			};
		},

		async ControllerStats() {
			const controllerData = getControllerData();
			const result = {
				statistics: formatObjectKeys(controllerData.statistics),
				backgroundRSSI: formatObjectKeys(controllerData.backgroundRSSI)
			};
			result.backgroundRSSI.Timestamp = formatDateTime(result.backgroundRSSI.Timestamp);
			return result;
		},

		// Failures are passed through to the template, which shows them in place of the setting.
		async ControllerSettings() {
			const [region, power, longRangePower] = await Promise.all([
				raw.get('CONTROLLER', 'getRFRegion'),
				raw.get('CONTROLLER', 'getPowerlevel'),
				raw.get('CONTROLLER', 'getMaxLongRangePowerlevel')
			]);

			return {
				Region: region.callSuccess ? `0x${region.response.toString(16).padStart(2, '0')}` : region,
				RDisabled: region.callSuccess ? '' : 'disabled="disabled"',
				Power: power.callSuccess ? power.response.powerlevel : power,
				LRPower: longRangePower.callSuccess ? longRangePower.response : longRangePower
			};
		},

		async NodeInfo() {
			return getSelectedNodeData();
		},

		async NodeStats() {
			const stats = formatObjectKeys(getSelectedNodeData().statistics);
			stats['Last Seen'] = formatDateTime(stats['Last Seen']);
			return stats;
		},

		async NodeAssociationGroups() {
			associationGroups = await runtime.post('CONTROLLER', 'getAllAssociationGroups', [requireSelectedNode().nodeId]);
			return associationGroups;
		},

		async SetInclusionOptions() {
			setTimeout(applyInclusionAvailability, 10); // the radio buttons are not in the DOM until the panel has rendered
			return {};
		},

		async StartCamera() {
			setTimeout(startQrScanner, 50); // the <video> element is not in the DOM until the panel has rendered
			return {};
		},

		async PrepSSList() {
			const entries = await runtime.getPath('s2/provisioningentries');
			entries.forEach((entry) => {
				entry.shortDSK = entry.dsk.split('-')[0];
				if (entry.status === 0) entry.checked = 'checked';
			});
			return { entries };
		}
	};

	/*
	 * 9. ACTIONS
	 */

	// ---- nodes ----

	const RemoveFailedNode = async (nodeId, row) => {
		const id = nodeId || selectedNode?.nodeId;
		if (!id) return;
		if (!(await confirmAction('Are you sure you wish to remove this Node from your network?'))) return;

		if ((await attempt(() => runtime.post('CONTROLLER', 'removeFailedNode', [id]))) && row) {
			$(row).closest('tr').remove();
		}
	};

	const PingNode = (nodeId) =>
		attempt(async () => {
			const alive = await runtime.post('NODE', 'ping', { nodeId });
			ZWJSAlert(alive ? 'Ping was successful' : 'Ping failed');
		});

	const SetNameLocation = (button) =>
		runButtonAction(button, async () => {
			const { nodeId } = requireSelectedNode();
			await runtime.post('NODE', 'setName', { nodeId, value: $('#zwjs-node-edit-name').val() || undefined });
			await runtime.post('NODE', 'setLocation', { nodeId, value: $('#zwjs-node-edit-location').val() || undefined });
			await RefreshNodes('Named');
			ZWJSAlert('Name & Location Set Successfully!');
		});

	// ---- node health check ----

	const HEALTH_TABLE = '#zwjs-node-health-check';

	const healthRow = (cells) => `<tr>${cells.map((cell) => `<td style="text-align:center">${cell}</td>`).join('')}</tr>`;

	const renderHealthRating = (rating) => {
		const state = rating > 5 ? 'good' : rating > 3 ? 'warn' : 'bad';
		return `<div class="zwjs-rating" ${state}>${rating}/10</div>`;
	};

	const appendHealthTestingRow = () =>
		$(HEALTH_TABLE).append(healthRow(['<div class="zwjs-rating" wait>Testing...</div>', ...Array(7).fill('---')]));

	const renderHealthCheckResult = (result) => {
		$(`${HEALTH_TABLE} tr:last`).remove();
		$(HEALTH_TABLE).append(
			healthRow([
				renderHealthRating(result.rating),
				result.failedPingsNode,
				result.failedPingsController ?? 0,
				result.routeChanges,
				`${result.latency} ms`,
				result.numNeighbors,
				`${result.minPowerlevel} dBm`,
				`${result.snrMargin} dBm`
			])
		);
		appendHealthTestingRow();
	};

	const CheckNodeHealth = (button) =>
		runButtonAction(button, async () => {
			const { nodeId } = requireSelectedNode();
			const topic = networkUrl('nodes/healthcheck'); // captured now, in case the network changes mid-test
			const onProgress = (unusedTopic, data) => {
				const lastResult = data?.check?.lastResult;
				if (lastResult) renderHealthCheckResult(lastResult);
			};

			$(HEALTH_TABLE).find('tr:gt(0)').remove();
			RED.comms.subscribe(topic, onProgress);
			appendHealthTestingRow();

			try {
				await runtime.post('NODE', 'checkLifelineHealth', { nodeId });
				await delay(250); // let the final progress event arrive
			} finally {
				$(`${HEALTH_TABLE} tr:last`).remove();
				RED.comms.unsubscribe(topic, onProgress);
			}
		});

	// ---- associations ----

	const ASSOCIATIONS_TABLE = '#zwjs-asso-mappings';
	const ROLE_NEW_ASSOCIATION = 'zwjs-new-association';
	const ROLE_REMOVE_ASSOCIATION = 'zwjs-remove-association';

	const getAssociationEndpointLabel = (endpoint) => {
		if (endpoint === undefined) return 'NODE';
		return endpoint === 0 ? 'ROOT' : `EP${endpoint}`;
	};

	const associationRow = ({ nodeId, endpoint }) =>
		`<tr data-node-id="${nodeId}" data-endpoint="${endpoint ?? ''}">` +
		`<td style="text-align:center"><span class="zwjs-node-id">${nodeId}</span></td>` +
		`<td style="text-align:center"><span class="zwjs-asso-ep">${getAssociationEndpointLabel(endpoint)}</span></td>` +
		'<td style="text-align:center"><i class="fa fa-trash" aria-hidden="true" style="font-size: 18px;color: red; cursor:pointer" onclick="ZWaveJS.MarkAssoDelete(this)"></i></td>' +
		'</tr>';

	const processAssociationEPSelect = () => {
		const groups = associationGroups?.[$('#zwjs-asso-endpoints').val()] ?? {};
		const select = $('#zwjs-asso-groups').empty().append(new Option('Select Association Group'));
		Object.entries(groups).forEach(([id, group]) => {
			select.append(new Option(`${group.label} (Max: ${group.maxNodes})`, id));
		});
	};

	const processAssociationGPSelect = async () => {
		const group = parseOptionalInt($('#zwjs-asso-groups').val());
		if (group === undefined) {
			$(ASSOCIATIONS_TABLE).empty(); // the placeholder entry is selected
			return;
		}

		await attempt(async () => {
			const address = { nodeId: requireSelectedNode().nodeId, endpoint: parseInt($('#zwjs-asso-endpoints').val(), 10) };
			const associations = await runtime.post('CONTROLLER', 'getAssociations', [address]);

			$(ASSOCIATIONS_TABLE)
				.empty()
				.append(
					'<tr><td style="text-align:center">Target Node</td><td style="text-align:center">Target Endpoint</td><td style="text-align:center">Delete</td></tr>'
				);
			(associations[group] || []).forEach((association) => $(ASSOCIATIONS_TABLE).append(associationRow(association)));
		});
	};

	const PreppNewAssociation = () => {
		$(ASSOCIATIONS_TABLE).append(
			`<tr data-role="${ROLE_NEW_ASSOCIATION}">` +
				'<td style="text-align:center"><input type="number" data-role="zwjs-node" value="1" min="1"></td>' +
				'<td style="text-align:center"><input type="number" data-role="zwjs-endpoint" min="0" placeholder="<Empty: Node-Association>"></td>' +
				'<td>&nbsp;</td></tr>'
		);
	};

	const MarkAssoDelete = (element) => {
		$(element).closest('tr').attr('data-role', ROLE_REMOVE_ASSOCIATION).css({ filter: 'grayscale()' });
	};

	/** [address of the selected node + endpoint, selected association group id] - the leading args of every association call. */
	const getSelectedAssociationGroup = () => {
		const group = parseOptionalInt($('#zwjs-asso-groups').val());
		if (group === undefined) throw new Error('Select an Association Group first');
		return [{ nodeId: requireSelectedNode().nodeId, endpoint: parseInt($('#zwjs-asso-endpoints').val(), 10) }, group];
	};

	const readAssociationsToRemove = () =>
		$(`[data-role='${ROLE_REMOVE_ASSOCIATION}']`)
			.map((index, row) => ({
				nodeId: parseInt($(row).attr('data-node-id'), 10),
				endpoint: parseOptionalInt($(row).attr('data-endpoint'))
			}))
			.get();

	const readAssociationsToAdd = () =>
		$(`[data-role='${ROLE_NEW_ASSOCIATION}']`)
			.map((index, row) => {
				const nodeId = parseInt($(row).find("[data-role='zwjs-node']").first().val(), 10);
				if (Number.isNaN(nodeId)) throw new Error('Enter a valid target Node ID for the new association');
				return { nodeId, endpoint: parseOptionalInt($(row).find("[data-role='zwjs-endpoint']").first().val()) };
			})
			.get();

	const CommitAssociations = (button) =>
		runButtonAction(button, async () => {
			// Read everything first, so invalid input is reported before anything has been changed.
			const groupArgs = getSelectedAssociationGroup();
			const removals = readAssociationsToRemove();
			const additions = readAssociationsToAdd();

			if (removals.length) await runtime.post('CONTROLLER', 'removeAssociations', [...groupArgs, removals]);
			if (additions.length) await runtime.post('CONTROLLER', 'addAssociations', [...groupArgs, additions]);

			ZWJSAlert('Associations have been successfully updated!');
			await processAssociationGPSelect();
		});

	const ResetAllAssociations = async (button) => {
		const confirmed = await confirmAction(
			'Are you sure you wish to wipe all Associations? this includes the LifeLine associations, you will need to re-create them after.'
		);
		if (!confirmed) return;

		await runButtonAction(button, async () => {
			const endpoints = await runtime.post('CONTROLLER', 'getAllAssociations', [requireSelectedNode().nodeId]);
			const removals = endpoints.flatMap((endpoint) =>
				Object.entries(endpoint.associations)
					.filter(([, addresses]) => addresses.length)
					.map(([group, addresses]) =>
						runtime.post('CONTROLLER', 'removeAssociations', [
							endpoint.associationAddress,
							parseInt(group, 10),
							addresses
						])
					)
			);
			await Promise.all(removals);

			ZWJSAlert('All associations successfully removed!');
			await processAssociationGPSelect();
		});
	};

	// ---- inclusion, exclusion and Smart Start ----

	const StartExclusion = () =>
		attempt(async () => {
			await runtime.get('CONTROLLER', 'beginExclusion');
			await RenderAdvanced('ZWJS_TPL_NIFWait', undefined, { mode: 'Exclusion' });
		});

	const StartInclusion = () => {
		const strategy = $('input[type="radio"][name="ZWJS_IS"]:checked').val();
		if (strategy === 'SS') return RenderAdvanced('ZWJS_TPL_QRRead', undefined, 'StartCamera');

		return attempt(async () => {
			await runtime.post('CONTROLLER', 'beginInclusion', [{ strategy: parseInt(strategy, 10), forceSecurity: false }]);
			await RenderAdvanced('ZWJS_TPL_NIFWait', undefined, { mode: 'Inclusion' });
		});
	};

	const readCheckedSecurityClasses = () =>
		$('input[type="checkbox"][name="ZWJS_SCLASS"]:checked')
			.map((index, checkbox) => parseInt($(checkbox).val(), 10))
			.get();

	const GrantClasses = async (button) => {
		const granted = { clientSideAuth, securityClasses: readCheckedSecurityClasses() };
		if (await attempt(() => runtime.postPath('s2/grant', [granted]))) disableButton(button);
	};

	const SubmitDSK = async (button) => {
		if (await attempt(() => runtime.postPath('s2/dsk', [$('#zwjs-dsk').val()]))) disableButton(button);
	};

	const SubmitProvisioningEntry = async (button) => {
		disableButton(button);
		const submitted = await attempt(async () => {
			const entry = {
				...decodeObject($('#zwjs-qrdata').attr('data-entry')),
				securityClasses: readCheckedSecurityClasses(),
				status: 0
			};
			await runtime.post('CONTROLLER', 'provisionSmartStartNode', [entry]);
		});

		if (submitted) {
			RenderAdvanced('ZWJS_TPL_SSDone');
		} else {
			enableButton(button);
		}
	};

	// Provisioning entries arrive from the template with display-only fields that the runtime must not receive.
	const decodeProvisioningEntry = (encodedEntry) => {
		const entry = decodeObject(encodedEntry);
		delete entry.checked;
		delete entry.shortDSK;
		return entry;
	};

	const SetPEActive = (checkbox, encodedEntry) =>
		attempt(async () => {
			const entry = decodeProvisioningEntry(encodedEntry);
			entry.status = $(checkbox).prop('checked') ? 0 : 1; // 0 = active, 1 = inactive
			await runtime.post('CONTROLLER', 'provisionSmartStartNode', [entry]);
		});

	const DeletePE = async (element, encodedEntry) => {
		const confirmed = await confirmAction(
			'Are you sure you wish to delete this Provisioning Entry? Note: it will not exclude the device.'
		);
		if (!confirmed) return;

		const deleted = await attempt(() =>
			runtime.post('CONTROLLER', 'unprovisionSmartStartNode', [decodeProvisioningEntry(encodedEntry).dsk])
		);
		if (deleted) $(element).parent().parent().remove();
	};

	// ---- joining / leaving another network as a secondary controller ----

	const JOIN_NETWORK_FAILURES = {
		1: 'The Controller is currently too busy to perform the join.',
		2: "The Controller's role does not permit joining as a secondary controller - try resetting it!",
		3: 'An unknown error occurred.'
	};

	const JoinAsSlave = async (button) => {
		try {
			const result = await runtime.get('CONTROLLER', 'beginJoiningNetwork');
			if (result === 0) {
				disableButton(button);
			} else if (JOIN_NETWORK_FAILURES[result]) {
				ZWJSAlert(JOIN_NETWORK_FAILURES[result]);
			}
		} catch (error) {
			reportError(error);
		}
	};

	const LeaveAsSlave = async (button) => {
		disableButton(button);
		try {
			await runtime.get('CONTROLLER', 'beginLeavingNetwork');
		} catch (error) {
			enableButton(button);
			reportError(error);
		}
	};

	// ---- controller ----

	const BackupNames = (button) =>
		runButtonAction(button, async () => {
			const nodes = await fetchNodes();
			const homeId = requireControllerHomeId();
			const namesAndLocations = nodes
				.filter((node) => node.nodeName !== undefined || node.nodeLocation !== undefined)
				.map((node) => ({ nodeId: node.nodeId, name: node.nodeName, location: node.nodeLocation }));

			downloadBlob(
				new Blob([JSON.stringify(namesAndLocations, null, 2)], { type: 'application/json' }),
				`zwave_names_locations_${homeId}.json`
			);
		});

	const RestoreNames = (button) =>
		runButtonAction(button, async () => {
			const file = await pickFile();
			if (!file) return;

			const entries = JSON.parse(await file.text());
			if (!Array.isArray(entries)) throw new Error('The selected backup does not contain a node list');
			if (!entries.every((entry) => Number.isInteger(entry?.nodeId))) {
				throw new Error('The selected backup contains an invalid node entry');
			}

			for (const { nodeId, name, location } of entries) {
				await runtime.post('NODE', 'setLocation', { nodeId, value: location || undefined });
				await runtime.post('NODE', 'setName', { nodeId, value: name || undefined });
			}

			await RefreshNodes('Named');
			ZWJSAlert('Restore Completed Successfully');
		});

	const CFGUpdate = () =>
		attempt(async () => {
			const availableVersion = await runtime.post('DRIVER', 'checkForConfigUpdates');
			if (availableVersion === undefined) {
				ZWJSAlert('No update available.');
				return;
			}

			const confirmed = await confirmAction(
				`A configuration database update is available (${availableVersion}). Would you like to update?`
			);
			if (!confirmed) return;

			const result = await raw.post('DRIVER', 'installConfigUpdate');
			ZWJSAlert(
				result.callSuccess && result.response
					? 'Update was installed.'
					: `Update was not installed: ${result.response}.`
			);
		});

	// Adds the viewed value as a new output on the chosen splitter node.
	const UpdateSplitter = () => {
		try {
			const splitter = RED.nodes.node($('#zwjs-splitters').val());
			if (!splitter) throw new Error('Select a splitter node first');
			if (!codeEditor) throw new Error('The value editor is not available');

			const valueId = JSON.parse(codeEditor.getValue());
			const entry = {
				valueId,
				index: splitter.splits.length ? Math.max(...splitter.splits.map((split) => split.index)) + 1 : 0,
				name: $('#zwjs-splitter-output-name').val(),
				strict: $('#zwjs-splitter-output-endpoint').prop('checked')
			};
			if (valueId.commandClass === undefined) entry.custom = true;

			splitter.splits.push(entry);
			splitter.outputs++;
			Object.assign(splitter, { dirty: true, changed: true, resize: true });

			RED.view.redraw(true);
			RED.nodes.dirty(true);
			closeTray();
		} catch (error) {
			reportError(error);
		}
	};

	const RebuildNodeRoutes = () =>
		attempt(async () => {
			await runtime.post('CONTROLLER', 'rebuildNodeRoutes', [requireSelectedNode().nodeId]);
			ZWJSAlert('Rebuilding Node routes completed successfully.');
		});

	const RebuildRoutes = (button, battery) =>
		runButtonAction(button, () => {
			const includeSleeping = Boolean(battery || $('#zwjs-routes-battery').prop('checked'));
			return runtime.post('CONTROLLER', 'beginRebuildingRoutes', [{ includeSleeping }]);
		});

	/** Reads the integer from `selector`, calls `method` with it, and reports the outcome. */
	const setControllerSetting = (button, { selector, description, method, successMessage, extraArgs = [] }) =>
		runButtonAction(button, async () => {
			const value = Number.parseInt($(selector).val(), 10);
			if (!Number.isFinite(value)) throw new Error(`Select a valid ${description}`);
			await runtime.post('CONTROLLER', method, [value, ...extraArgs]);
			ZWJSAlert(successMessage);
		});

	const SetClassicPowerLevel = (button) =>
		setControllerSetting(button, {
			selector: '#zwjs-controller-setting-power-classic',
			description: 'classic power level',
			method: 'setPowerlevel',
			extraArgs: [0],
			successMessage: 'Power Level Set Successfully'
		});

	const SetLWPowerLevel = (button) =>
		setControllerSetting(button, {
			selector: '#zwjs-controller-setting-power-lr',
			description: 'Long Range power level',
			method: 'setMaxLongRangePowerlevel',
			successMessage: 'Power Level Set Successfully'
		});

	const SetRegion = (button) =>
		setControllerSetting(button, {
			selector: '#zwjs-controller-setting-region option:selected',
			description: 'RF region',
			method: 'setRFRegion',
			successMessage: 'Region Set Successfully'
		});

	const RestartController = async (button) => {
		if (await runButtonAction(button, () => runtime.get('DRIVER', 'restart'))) closeTray();
	};

	const ResetController = async (button) => {
		const confirmed = await confirmAction(
			'Are you sure you wish to continue? This will reset the controller back to Factory Standard, and if operating as the Primary Controller - will clear the Network of all Nodes.'
		);
		if (!confirmed) return;

		if (await runButtonAction(button, () => runtime.get('DRIVER', 'hardReset'))) {
			ZWJSAlert('The Controller has been Reset - It will now be refreshed in the UI');
			closeTray();
			NetworkSelected();
		}
	};

	const BackupController = (button) =>
		runButtonAction(button, async () => {
			const nvm = await runtime.get('CONTROLLER', 'backupNVMRaw');
			const fileName = `zwave_nvm_${requireControllerHomeId()}.bin`;
			const blob = new Blob([new Uint8Array(Object.values(nvm))], { type: 'application/octet-stream' });

			ZWJSAlert(`Controller Backup is now completed, your browser will now download the file: ${fileName}`);
			downloadBlob(blob, fileName);
			setTimeout(() => $('#zwjs-prog-contain-nvm').css({ display: 'none' }), 100);
		});

	const RestoreController = async (button) => {
		const confirmed = await confirmAction(
			'Note: This will alter the Controllers NVM, and will be configured according to the backup file you will restore to - Do you wish to continue?'
		);
		if (!confirmed) return;

		await runButtonAction(button, async () => {
			const file = await pickFile();
			if (!file) return;

			const nvmData = await readFileAsUint8Array(file);
			await runtime.post('CONTROLLER', 'restoreNVM', [{ nvmData }]);
			ZWJSAlert('The restore has been completed! - Please allow a few minutes for the controller to reboot.');
		});
	};

	// ---- firmware ----

	const handleBootloader = () => {
		bootloaderMode = true;
		RED.notify(
			'WARNING! Your ZWave controller failed to boot, and is currently in recovery mode, please upload new firmware from the side bar',
			{ type: 'error', timeout: 30000 }
		);
	};

	// Confirms, then picks a firmware file and starts the update. The button stays disabled while the update runs.
	const startFirmwareUpdateFromFile = async (button, confirmation, startUpdate) => {
		if (!(await confirmAction(confirmation))) return;
		const file = await pickFile();
		if (!file) return;

		disableButton(button);
		try {
			await startUpdate(await readFileAsUint8Array(file));
		} catch (error) {
			enableButton(button);
			throw error;
		}
	};

	const UpdateNFirmware = (button) =>
		attempt(() => {
			const { nodeId } = requireSelectedNode();
			return startFirmwareUpdateFromFile(
				button,
				"Note: This will update the Node's firmware, do you wish to proceed?",
				(data) => runtime.post('NODE', 'updateFirmware', { nodeId, args: [[{ data }]] })
			);
		});

	const UpdateCFirmware = (button) =>
		attempt(() =>
			startFirmwareUpdateFromFile(
				button,
				'Note: This will update the Controllers firmware, do you wish to proceed?',
				(data) => runtime.post('DRIVER', 'firmwareUpdateOTW', [{ data }])
			)
		);

	const UpdateNFirmwareFUS = async (nodeId, encodedUpdate) => {
		const update = decodeObject(encodedUpdate);
		const confirmed = await confirmAction(
			`Note: This will update the Node firmware to the update chosen (version: ${update.normalizedVersion}), do you wish to proceed?`
		);
		if (!confirmed) return;

		await RenderAdvanced('ZWJS_TPL_Tray-Node-Firmware');
		await attempt(() => runtime.post('DRIVER', 'firmwareUpdateOTA', [nodeId, update]));
	};

	const UpdateCFirmwareFUS = async (encodedUpdate) => {
		const update = decodeObject(encodedUpdate);
		const confirmed = await confirmAction(
			`Note: This will update the Controllers firmware to the update chosen (version: ${update.normalizedVersion}), do you wish to proceed?`
		);
		if (!confirmed) return;

		await RenderAdvanced('ZWJS_TPL_Tray-Controller-Firmware');
		await attempt(() => runtime.post('DRIVER', 'firmwareUpdateOTW', [update]));
	};

	/*
	 * 10. RUNTIME EVENTS (COMMS) AND PUBLIC API
	 */

	const showProgress = (name, percentage, label) => {
		$(`#zwjs-prog-contain-${name}`).css({ display: 'block' });
		$(`#zwjs-prog-bar-${name}`)
			.css({ width: `${percentage}%` })
			.text(`${label} ${Math.round(percentage)}%`);
	};

	const toPercentage = (done, total) => (total ? (done / total) * 100 : 0);

	const commsNVMBackupProgressReport = (topic, data) =>
		showProgress('nvm', toPercentage(data.bytesRead, data.total), data.label);

	const commsNVMRestoreProgressReport = (topic, data) =>
		showProgress('nvm', toPercentage(data.done, data.total), data.label);

	// ---- firmware updates ----

	const FIRMWARE_FAILURES = {
		0: 'A timeout occurred',
		1: 'The maximum number of retry attempts for a firmware fragment was reached',
		2: 'The update was aborted by the bootloader'
	};

	const getFirmwareResultMessage = (status, device, successMessage) => {
		if (status === 3) return `This ${device} does not support firmware updates`;
		return FIRMWARE_FAILURES[status] ?? successMessage;
	};

	const commsNFirmwareReport = (topic, data) => {
		if (topic.endsWith('progress')) {
			showProgress('nfirmware', data.progress.progress, 'Flashing Chip...');
		}

		if (topic.endsWith('finished')) {
			const Message = getFirmwareResultMessage(
				data.result.status,
				'device',
				'The update was successful, please wait a few minutes for the Node to reinitialize'
			);
			RenderAdvanced('ZWJS_TPL_Tray-Firmware-Done', undefined, { Message });
		}
	};

	const commsCFirmwareReport = (topic, data) => {
		if (topic.endsWith('progress')) {
			showProgress('cfirmware', data.progress, 'Flashing Chip...');
		}

		if (topic.endsWith('finished')) {
			const Message = getFirmwareResultMessage(
				data.status,
				'controller',
				'The update was successful, please wait a few moments...'
			);
			if (!(data.status in FIRMWARE_FAILURES) && data.status !== 3) {
				// Give the controller time to reboot into the new firmware, then restart the driver.
				const restartUrl = networkUrl('DRIVER/restart');
				setTimeout(() => request('GET', restartUrl).catch(reportError), 15000);
			}
			RenderAdvanced('ZWJS_TPL_Tray-Firmware-Done', undefined, { Message });
		}
	};

	// ---- rebuild routes ----

	const REBUILD_ROUTES_COLUMNS = ['pending', 'done', 'failed', 'skipped'];

	const commsRebuildRoutesProgress = (topic, data) => {
		const table = $('#zwjs-routes-progress');
		if (!table.length) return;

		const columns = Object.fromEntries(REBUILD_ROUTES_COLUMNS.map((column) => [column, []]));
		Object.entries(data.Progress).forEach(([nodeId, status]) => columns[status]?.push(nodeId));
		const rowCount = Math.max(...REBUILD_ROUTES_COLUMNS.map((column) => columns[column].length));

		table.find('tr:gt(0)').remove();
		for (let i = 0; i < rowCount; i++) {
			const cells = REBUILD_ROUTES_COLUMNS.map((column) => {
				const nodeId = columns[column][i];
				return `<td style="text-align:center">${nodeId === undefined ? '' : `<span class="zwjs-node-id">${nodeId}</span>`}</td>`;
			});
			table.append(`<tr>${cells.join('')}</tr>`);
		}
	};

	// ---- controller, nodes and values ----

	const commsStatus = (topic, data) => {
		$('#zwjs-controller-status, #zwjs-controller-status-tray').text(data.status);

		if (data.status === STATUS_BOOTLOADER) {
			handleBootloader();
			return;
		}

		bootloaderMode = false;
		if (data.status === STATUS_DRIVER_READY) RefreshNodes('DriverReady');
	};

	const commsNodeState = (topic, data) => {
		const node = data.nodeInfo;
		const item = findTreeItem(node.nodeId);
		if (item) item.nodeData = node;

		// Sleep / wake-up changes should not rebuild the panel the user is looking at.
		const refreshSelection =
			selectedNode?.nodeId === node.nodeId && !topic.endsWith('sleep') && !topic.endsWith('wakeup');
		if (refreshSelection) nodeSelected(undefined, { nodeData: node });

		renderNodeIconState(node);
		renderGroupIconState();
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
		if (selectedNode?.nodeId !== data.nodeId) return;

		const { valueId, newValue } = data.eventBody;
		const hash = getValueUpdateHash(valueId);
		const valueInfo = selectedNodeValues[hash];
		if (valueInfo) valueInfo.currentValue = newValue;

		const text = formatDisplayValue(newValue, valueInfo?.metadata);
		(valueInfo?.valueElement ?? $(`#zwjs-value-${hash}`)).text(text);
	};

	const commsHandleSlaveOps = (topic, data) => {
		if (topic.endsWith('dsk')) {
			RenderAdvanced('ZWJS_TPL_Tray-Controller-Slave-DSK', undefined, {
				...data,
				slaveJoinDSK: data.slaveJoinDSK.toString().substring(0, 5)
			});
		} else if (topic.endsWith('joined')) {
			closeTray();
			RefreshNodes('NetworkJoin');
		} else if (topic.endsWith('left')) {
			closeTray();
			RefreshNodes('NetworkLeft');
		}
	};

	// ---- S2 inclusion ----

	const commsGrant = (topic, data) => {
		clientSideAuth = data.clientSideAuth;
		RenderAdvanced('ZWJS_TPL_SecurityGrant', undefined, { classes: toSecurityClassList(data.securityClasses) });
	};

	const commsDSK = (topic, data) => {
		RenderAdvanced('ZWJS_TPL_DSK', undefined, data);
	};

	// ---- subscriptions ----

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
		const method = subscribe ? 'subscribe' : 'unsubscribe';
		COMMS_HOOKS.forEach(([topic, handler]) => RED.comms[method](`zwave-js/ui/${targetNetworkId}/${topic}`, handler));
	};

	/*
	 * PUBLIC API: everything the HTML templates call via inline handlers, e.g. onclick="ZWaveJS.RefreshNodes('Refresh')".
	 */
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
		RenderMapDialog,
		RestartController
	};
})();
