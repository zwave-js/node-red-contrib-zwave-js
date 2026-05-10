/* eslint no-undef: "warn"*/
const StepsCollection = [
	{
		icon: 'fa wifi',
		title: 'Welcome to Z-Wave JS for Node-RED',
		content:
			'<p>The most powerful, high-performing, and highly polished Z-Wave node for Node-RED, based on Z-Wave JS.</p>'
	},
	{
		title: 'Here are the nodes that have been installed.',
		content: `<ul>
                    <li>The Controller Node</li>
                    <li>The Device Node</li>
                    <li>The Event Splitter</li>
                    <li>The CMD Factory</li>
                </ul>`,
		prep: (done) => {
			$('#red-ui-palette-container').scrollTop($('#red-ui-palette-header-ZWave_JS').position().top);
			setTimeout(done, 250);
		},
		dom: '#red-ui-palette-base-category-ZWave_JS'
	},
	{
		title: 'The Controller Node',
		image: '../../../../resources/node-red-contrib-zwave-js/tours/images/Controller.png',
		content:
			"<p>This node receives network-level events that aren't specific to individual devices in your network. It does, however, support all outgoing commands, device-specific or otherwise.</p>"
	},
	{
		title: 'The Device Node',
		image: '../../../../resources/node-red-contrib-zwave-js/tours/images/Device.png',
		content: '<p>This node receives device-level events, as well as outgoing device-specific commands.</p>'
	},
	{
		title: 'The Event Splitter',
		image: '../../../../resources/node-red-contrib-zwave-js/tours/images/Splitter.png',
		content: '<p>This node allows you to only pass through events for a specific Z-Wave Command Class.</p>'
	},
	{
		title: 'The CMD Factory',
		image: '../../../../resources/node-red-contrib-zwave-js/tours/images/CMD.png',
		content: '<p>This node allows you to generate Z-Wave command payloads for advanced workflows and automations.</p>'
	},
	{
		title: 'The Network Management Panel',
		image: '../../../../resources/node-red-contrib-zwave-js/tours/images/Top.png',
		content:
			'<p>The side panel allows for general (and advanced) network operations that help with setting up your nodes and network.</p>',
		dom: '#zwjs-node-list > div > div > div',
		prep: (done) => {
			RED.sidebar.show('zwave-js');
			setTimeout(done, 250);
		}
	},
	{
		title: 'The Node Management Panel',
		image: '../../../../resources/node-red-contrib-zwave-js/tours/images/Bottom.png',
		content:
			"<p>Clicking a device in the list above will show its detailed information here. You can also make changes to a device's setup.</p>",
		dom: '#zwjs-panel-stack > div:nth-child(3)'
	},
	{
		title: 'The Advanced Operations Tray',
		content:
			'<p>Both the selected node and network panels provide access to advanced operations. Click here to open the advanced tray.</p>',
		dom: '#zwjs-sidebar > div.red-ui-sidebar-header.zwjs-sb-menu-header > a:nth-child(1)',
		prep: () => {
			$('.red-ui-tourGuide-shade').css({
				pointerEvents: 'none'
			});
		},
		completed: () => {
			$('.red-ui-tourGuide-shade').css({
				pointerEvents: 'all'
			});
		},
		waitFor: {
			type: 'dom-event',
			event: 'click',
			element: '#zwjs-sidebar > div.red-ui-sidebar-header.zwjs-sb-menu-header > a:nth-child(1)'
		}
	},
	{
		direction: 'right',
		title: 'Once opened, you have access to various advanced operations',
		content:
			'<p>The available operations depend on whether the advanced tray was opened from a node or from the main network pane.</p>',
		dom: '#red-ui-editor-stack > div > div.red-ui-tray-body-wrapper > div > div.zwjs-tray-menu',
		prep: (done) => {
			ZWaveJS.ShowNetworkManagementDemo();
			setTimeout(done, 250);
		}
	},
	{
		title: 'To close the advanced tray, simply click the Close button.',
		content: "<p>Let's do it now.</p>",
		dom: '#zwjs-tray-close',
		prep: () => {
			$('.red-ui-tourGuide-shade').css({
				pointerEvents: 'none'
			});
		},
		completed: () => {
			$('.red-ui-tourGuide-shade').css({
				pointerEvents: 'all'
			});
		},
		waitFor: {
			type: 'dom-event',
			event: 'click',
			element: '#zwjs-tray-close'
		}
	},
	{
		title: 'Thats it for now - Have Fun!',
		content:
			'<p>Further tours are avalable, just look for the <strong>Show Me</strong> links. Enjoy, and please raise issues on my Github or the Node RED forums</p>'
	}
];

export default {
	steps: StepsCollection.map((step) => ({
		title: {
			'en-US': step.title
		},

		description: {
			'en-US': step.content
		},

		width: step.width || 400,

		...(step.image && {
			image: step.image
		}),

		...(step.icon && {
			icon: step.icon
		}),

		...(step.dom && {
			element: step.dom
		}),

		...(step.direction && {
			direction: step.direction
		}),

		...(step.prep && {
			prepare: step.prep
		}),

		...(step.completed && {
			complete: step.completed
		}),

		...(step.waitFor && {
			wait: step.waitFor
		})
	}))
};
