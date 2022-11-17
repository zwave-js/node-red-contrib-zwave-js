/* eslint-disable prefer-const */
/* eslint-env jquery */
/* eslint-env browser */
/* eslint no-undef: "warn"*/
/* eslint no-unused-vars: "warn"*/

const ZWaveJSUI = (function () {
	let networkId;
	let displayedOptionsPanel;

	const restoreDisplay = function () {
		if (displayedOptionsPanel) {
			displayedOptionsPanel.remove();
		}

		$('#zwavejs-panel-stack').css({ display: 'flex' });
	};

	const showRadioSettings = () => {
		restoreDisplay();
		const Parent = $('#zwavejs-panel-stack').parent();
		$('#zwavejs-panel-stack').css({ display: 'none' });

		displayedOptionsPanel = $('<div>').addClass('zwavejs-options-panel');
		displayedOptionsPanel.append('<span>Advanced Transceiver Settings</span>');

		// Region
		const Region = $('<div>').addClass('form-row');
		$('<label>').attr('for', 'tx-region').text('RF Region').css({ textAlign: 'left', width: '70%' }).appendTo(Region);
		$('<select>')
			.attr('id', 'tx-region')
			.css({ width: '70%' })
			.append('<option value="0x00">Europe</option>')
			.append('<option value="0x01">USA</option>')
			.append('<option value="0x02">Australia/New Zealand</option>')
			.append('<option value="0x03">Hong Kong</option>')
			.append('<option value="0x05">India</option>')
			.append('<option value="0x06">Israel</option>')
			.append('<option value="0x07">Russia</option>')
			.append('<option value="0x08">China</option>')
			.append('<option value="0x09">USA (Long Range)</option>')
			.append('<option value="0x20">Japan</option>')
			.append('<option value="0x21">Korea</option>')
			.append('<option value="0xfe">Unknown</option>')
			.append('<option value="0xff">Default (EU)</option>')
			.appendTo(Region);
		displayedOptionsPanel.append(Region);

		// POwer Level
		const Power = $('<div>').addClass('form-row');
		$('<label>')
			.attr('for', 'tx-power')
			.text('RF Power Level (dBm)')
			.css({ textAlign: 'left', width: '70%' })
			.appendTo(Power);
		$('<input>').attr('type', 'number').attr('id', 'tx-power').attr('step', '.1').val(0).appendTo(Power);
		$('<input>').attr('type', 'number').attr('id', 'tx-0measured').attr('step', '.1').val(6.4).appendTo(Power);
		displayedOptionsPanel.append(Power);

		$('<button>')
			.addClass('ui-button')
			.addClass('ui-corner-all')
			.addClass('ui-widget')
			.addClass('zwavejs-full-width-button')
			.text('Backup NVM')
			.click()
			.appendTo(displayedOptionsPanel);

		$('<button>')
			.addClass('ui-button')
			.addClass('ui-corner-all')
			.addClass('ui-widget')
			.addClass('zwavejs-full-width-button')
			.text('Restore NVM')
			.click()
			.appendTo(displayedOptionsPanel);

		$('<button>')
			.addClass('ui-button')
			.addClass('ui-corner-all')
			.addClass('ui-widget')
			.addClass('zwavejs-full-width-button')
			.addClass('zwavejs-cancel')
			.text('Cancel')
			.click(restoreDisplay)
			.appendTo(displayedOptionsPanel);

		Parent.append(displayedOptionsPanel);
	};

	const showInclusionOptions = () => {
		restoreDisplay();
		const Parent = $('#zwavejs-panel-stack').parent();
		$('#zwavejs-panel-stack').css({ display: 'none' });

		displayedOptionsPanel = $('<div>').addClass('zwavejs-options-panel');
		displayedOptionsPanel.append('<span>Inclusion/Exclusion Options</span>');

		$('<button>')
			.addClass('ui-button')
			.addClass('ui-corner-all')
			.addClass('ui-widget')
			.addClass('zwavejs-full-width-button')
			.text('Default')
			.appendTo(displayedOptionsPanel);

		$('<button>')
			.addClass('ui-button')
			.addClass('ui-corner-all')
			.addClass('ui-widget')
			.addClass('zwavejs-full-width-button')
			.text('Smart Start')
			.appendTo(displayedOptionsPanel);

		$('<button>')
			.addClass('ui-button')
			.addClass('ui-corner-all')
			.addClass('ui-widget')
			.addClass('zwavejs-full-width-button')
			.text('S0')
			.appendTo(displayedOptionsPanel);

		$('<button>')
			.addClass('ui-button')
			.addClass('ui-corner-all')
			.addClass('ui-widget')
			.addClass('zwavejs-full-width-button')
			.text('No Encryption')
			.appendTo(displayedOptionsPanel);

		$('<button>')
			.addClass('ui-button')
			.addClass('ui-corner-all')
			.addClass('ui-widget')
			.addClass('zwavejs-full-width-button')
			.text('Remove Node')
			.appendTo(displayedOptionsPanel);

		$('<button>')
			.addClass('ui-button')
			.addClass('ui-corner-all')
			.addClass('ui-widget')
			.addClass('zwavejs-full-width-button')
			.text('Provisioning List')
			.appendTo(displayedOptionsPanel);

		$('<button>')
			.addClass('ui-button')
			.addClass('ui-corner-all')
			.addClass('ui-widget')
			.addClass('zwavejs-full-width-button')
			.addClass('zwavejs-cancel')
			.text('Cancel')
			.click(restoreDisplay)
			.appendTo(displayedOptionsPanel);

		Parent.append(displayedOptionsPanel);
	};

	const networkSelected = function () {
		// Remove Subscriptions
		if (networkId) {
			RED.comms.unsubscribe(`zwave-js/ui/${this.vale}/status`);
			networkId = undefined;
		}

		networkId = this.value;

		// get Nodes ansd Info
		$.getJSON(`zwave-js/ui/${networkId}/nodes`, (data) => {
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
		});

		$.getJSON(`zwave-js/ui/${networkId}/status`, (data) => {
			$('#zwavejs-radio-status').text(data.status);
		});

		// subscribe
		RED.comms.subscribe(`zwave-js/ui/${networkId}/status`, (event, data) => {
			$('#zwavejs-radio-status').text(data.status);
		});
	};

	const nodeSelected = (event, item) => {
		$('#zwavejs-node-model').text(
			`${item.nodeData.nodeId} - ${item.nodeData.nodeName || item.nodeData.deviceConfig.label}`
		);
		$('#zwavejs-node-manufacture').text(`${item.nodeData.deviceConfig.manufacturer}, `);
		$('#zwavejs-node-version').text(`${item.nodeData.firmwareVersion}, `);
		$('#zwavejs-node-status').text(`${item.nodeData.status}`);

		$.getJSON(`zwave-js/ui/${networkId}/getValueDB/${item.nodeData.nodeId}`, (data) => {
			data = data[0];
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
		});
	};

	const addNodeMenuItems = (MenuHeader) => {
		const Inclusion = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-handshake-o"></i>');
		MenuHeader.append(Inclusion);

		const EditName = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-pencil"></i>');
		MenuHeader.append(EditName);

		const Associate = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-code-fork"></i>');
		MenuHeader.append(Associate);

		const Repair = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-medkit"></i>');
		MenuHeader.append(Repair);

		const Health = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-stethoscope"></i>');
		MenuHeader.append(Health);

		const Replace = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-chain-broken"></i>');
		MenuHeader.append(Replace);

		const Remove = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-trash-o"></i>');
		MenuHeader.append(Remove);

		const Firmware = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-download"></i>');
		MenuHeader.append(Firmware);
	};

	const addControllerMenuItems = (MenuHeader) => {
		const Inclusion = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.css({ cursor: 'pointer' })
			.append('<i class="fa fa-handshake-o"></i>')
			.click(showInclusionOptions);
		MenuHeader.append(Inclusion);

		const Map = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.append('<i class="fa fa-globe"></i>');
		MenuHeader.append(Map);

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

		const Settings = $('<a>')
			.addClass('red-ui-tab-link-button')
			.addClass('ui-draggable')
			.addClass('ui-draggable-handle')
			.css({ cursor: 'pointer' })
			.append('<i class="fa fa-cog"></i>')
			.click(showRadioSettings);
		MenuHeader.append(Settings);
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
				if (R.type === 'zwavejs-runtime') {
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
