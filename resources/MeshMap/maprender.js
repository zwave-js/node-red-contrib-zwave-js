/* eslint-env jquery */
/* eslint-env browser */
/*eslint no-undef: "warn"*/
/*eslint no-unused-vars: "warn"*/

let Mesh;

const DataRate = {
	1: '9.6 kbps',
	2: '40 kbps',
	3: '100 kbps',
	4: '100 kbps (LR)'
};

function Render(Base) {
	const Elements = [];
	const Nodes = JSON.parse(localStorage.getItem('ZWJSMapData'));

	console.log(Nodes);

	Nodes.forEach((N) => {
		if (N.controller) {
			const EL = {
				data: {
					isController: N.controller,
					id: N.nodeId,
					name: 'Controller',
					nameOnly: `Controller`,
					location: `Hopefully away from interference.`,
					lastSeen: '0',
					fontSize: '12px',
					icon: `${Base}/Stick.png`,
					powerSource: { type: 'bus' },
					statistics: N.statistics
				}
			};
			Elements.push(EL);
		} else {
			const EL = {
				data: {
					isController: N.controller,
					id: N.nodeId,
					name: `${N.nodeId} - ${N.name || 'No Name'}`,
					nameOnly: `${N.name || 'No Name'}`,
					location: `${N.location || 'No Location'}`,
					fontSize: '10px',
					icon:
						N.powerSource.type === 'battery'
							? `${Base}/Battery.png`
							: `${Base}/Mains.png`,
					powerSource: N.powerSource,
					statistics: N.statistics,
					path: []
				}
			};
			if(N.lastSeen > 0){
				EL.data.lastSeen = new Date(N.lastSeen).toLocaleString();
			}
			else{
				EL.data.lastSeen = 'Never';
			}

			Elements.push(EL);

			if (N.statistics.lwr !== undefined) {
				const Stats = N.statistics.lwr;
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
									color: '#f1f1f1'
								}
							};
							Elements.push(EL);
							Elements.filter(
								(_N) => _N.data.id === N.nodeId
							)[0].data.path.push(EL.data.id);
							First = false;
							Last = R;
						} else {
							const EL = {
								data: {
									id: `${Last}.${R}`,
									source: Last,
									target: R,
									color: '#f1f1f1'
								}
							};
							Elements.push(EL);
							Elements.filter(
								(_N) => _N.data.id === N.nodeId
							)[0].data.path.push(EL.data.id);
							Last = R;
						}
					});

					const EL = {
						data: {
							id: `${Last}.${1}`,
							source: Last,
							target: 1,
							color: '#f1f1f1'
						}
					};
					Elements.push(EL);
					Elements.filter((_N) => _N.data.id === N.nodeId)[0].data.path.push(
						EL.data.id
					);
				} else {
					const EL = {
						data: {
							id: `${N.nodeId}.${1}`,
							source: N.nodeId,
							target: 1,
							color: '#f1f1f1'
						}
					};
					Elements.push(EL);
					Elements.filter((_N) => _N.data.id === N.nodeId)[0].data.path.push(
						EL.data.id
					);
				}
			}
		}
	});

	const StyleSheet = cytoscape.stylesheet();

	// Node
	StyleSheet.selector('node').css({
		'font-size': 'data(fontSize)',
		width: '30px',
		height: '30px',
		'background-image': 'data(icon)',
		'background-color': 'white',
		'background-fit': 'cover cover',
		label: 'data(name)'
	});

	// Edge
	StyleSheet.selector('egde').css({
		'curve-style': 'bezier',
		'target-arrow-shape': 'triangle',
		'target-arrow-color': '#f1f1f1',
		'line-color': 'data(color)',
		trasitionDuration: '1s'
	});

	const data = {
		layout: {
			animate: false,
			name: 'spread',
			minDist: 20,
			prelayout: { name: 'cose', animate: false }
		},
		container: $('#NetworkMesh')[0],
		style: StyleSheet,
		elements: Elements
	};

	Mesh = cytoscape(data);
	Mesh.on('tap', 'node', LoadData);
}

function LoadData() {
	const Data = $('<ul>');
	const NodePath = this.data('path');

	Mesh.edges().css({ lineColor: '#ededed', 'target-arrow-color': '#f1f1f1' });

	if (NodePath !== undefined) {
		Mesh.edges().css({ lineColor: '#ededed', 'target-arrow-color': '#f1f1f1' });
		let MST = 1;
		NodePath.forEach((PS) => {
			const Color =
				Mesh.edges("[id='" + PS + "']").data().target === '1'
					? 'green'
					: 'black';

			setTimeout(() => {
				Mesh.edges("[id='" + PS + "']").css({
					lineColor: Color,
					zIndex: 100,
					'target-arrow-color': 'black'
				});
			}, 150 * MST);
			MST++;
		});
	} else {
		Mesh.edges("[target='1']").css({
			lineColor: 'green',
			'target-arrow-color': 'black'
		});
	}

	// Node
	const Node = $('<li>');
	Node.css({ marginBottom: '10px' });
	Node.html('<strong>Node Details</strong>');
	Node.appendTo(Data);

	const NodeDetails = $('<ul>');
	NodeDetails.appendTo(Node);
	$(`<li>ID: ${this.data('id')}</li>`).appendTo(NodeDetails);
	$(`<li>Name: ${this.data('nameOnly')}</li>`).appendTo(NodeDetails);
	$(`<li>Location: ${this.data('location')}</li>`).appendTo(NodeDetails);

	// Supply
	const Battery = $('<li>');
	Battery.css({ marginBottom: '10px' });
	Battery.html('<strong>Power Supply</strong>');
	Battery.appendTo(Data);

	const BatteryDetails = $('<ul>');
	BatteryDetails.appendTo(Battery);
	$(`<li>Source: ${this.data('powerSource').type}</li>`).appendTo(
		BatteryDetails
	);

	if (this.data('powerSource').type === 'battery') {
		$(`<li>Current Level: ${this.data('powerSource').level}</li>`).appendTo(
			BatteryDetails
		);
	}

	// Performance
	if (this.data('statistics').rtt !== undefined) {
		const Performance = $('<li>');
		Performance.css({ marginBottom: '10px' });
		Performance.html('<strong>Performance</strong>');
		Performance.appendTo(Data);

		const PerformanceDetails = $('<ul>');
		PerformanceDetails.appendTo(Performance);
		$(`<li>Round Trip Time (ms): ${this.data('statistics').rtt}</li>`).appendTo(
			PerformanceDetails
		);

		if (this.data('statistics').lwr !== undefined) {
			$(
				`<li>Protocol Data Rate : ${
					DataRate[this.data('statistics').lwr.protocolDataRate]
				}</li>`
			).appendTo(PerformanceDetails);
			$(
				`<li>ACK RSSI (Received by Controller): ${
					this.data('statistics').lwr.rssi
				} dBm</li>`
			).appendTo(PerformanceDetails);
		}
		$(
			`<li>ACK RSSI (Received by Node): ${
				this.data('statistics').rssi
			} dBm</li>`
		).appendTo(PerformanceDetails);
	}

	// Network Stats
	const NetStats = $('<li>');
	NetStats.css({ marginBottom: '10px' });
	NetStats.html('<strong>Network Statistics</strong>');
	NetStats.appendTo(Data);

	const NetStatsDetails = $('<ul>');
	NetStatsDetails.appendTo(NetStats);

	if (this.data('isController')) {
		$(`<li>Messages TX: ${this.data('statistics').messagesTX}</li>`).appendTo(
			NetStatsDetails
		);
		$(
			`<li>Messages Dropped TX: ${
				this.data('statistics').messagesDroppedTX
			}</li>`
		).appendTo(NetStatsDetails);

		$(`<li>Messages RX: ${this.data('statistics').messagesRX}</li>`).appendTo(
			NetStatsDetails
		);
		$(
			`<li>Messages Dropped RX: ${
				this.data('statistics').messagesDroppedRX
			}</li>`
		).appendTo(NetStatsDetails);
		$(`<li>NAK: ${this.data('statistics').NAK}</li>`).appendTo(NetStatsDetails);
		$(`<li>CAN: ${this.data('statistics').CAN}</li>`).appendTo(NetStatsDetails);
		$(`<li>ACK Timeout: ${this.data('statistics').timeoutACK}</li>`).appendTo(
			NetStatsDetails
		);
		$(
			`<li>Response Timeout: ${this.data('statistics').timeoutResponse}</li>`
		).appendTo(NetStatsDetails);
		$(
			`<li>Callback Timeout: ${this.data('statistics').timeoutCallback}</li>`
		).appendTo(NetStatsDetails);
	} else {
		$(`<li>Commands TX: ${this.data('statistics').commandsTX}</li>`).appendTo(
			NetStatsDetails
		);
		$(
			`<li>Commands TXD: ${this.data('statistics').commandsDroppedTX}</li>`
		).appendTo(NetStatsDetails);
		$(`<li>Commands RX: ${this.data('statistics').commandsRX}</li>`).appendTo(
			NetStatsDetails
		);
		$(
			`<li>Commands RXD: ${this.data('statistics').commandsDroppedRX}</li>`
		).appendTo(NetStatsDetails);
		$(`<li>Timeouts: ${this.data('statistics').timeoutResponse}</li>`).appendTo(
			NetStatsDetails
		);

		// Node details addition
		$(`<li>Last Seen: ${this.data('lastSeen')}</li>`).appendTo(NodeDetails);
	}

	$('#Details').html(Data);
}
