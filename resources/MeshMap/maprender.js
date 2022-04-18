/* eslint-env jquery */
/* eslint-env browser */
/*eslint no-undef: "warn"*/
/*eslint no-unused-vars: "warn"*/

function getCookie(cname) {
	const name = cname + '=';
	const decodedCookie = decodeURIComponent(document.cookie);
	const ca = decodedCookie.split(';');
	for (let i = 0; i < ca.length; i++) {
		let c = ca[i];
		while (c.charAt(0) == ' ') {
			c = c.substring(1);
		}
		if (c.indexOf(name) == 0) {
			return c.substring(name.length, c.length);
		}
	}
	return '';
}

const DataRate = {
    1: '9.6 kbps',
    2: '40 kbps',
    3: '100 kbps',
    4: '100 kbps (LR)'
}

function Render() {
	const Elements = [];
	const Nodes = JSON.parse(getCookie('ZWJSMapData'));

	console.log(Nodes);

	Nodes.forEach((N) => {
		if (N.controller) {
			const EL = {
				data: {
					id: N.nodeId,
					name: 'Controller',
					fontSize: '12px',
					icon: './Stick.png'
				}
			};
			Elements.push(EL);
		} else {
			const EL = {
				data: {
					id: N.nodeId,
					name: `${N.nodeId} - ${N.name || 'No Name'}`,
                    nameOnly: `${N.name || 'No Name'}`,
                    location: `${N.location || 'No Location'}`,
					fontSize: '10px',
					icon: './Device.png',
                    powerSource: N.powerSource,
                    statistics: N.statistics
				}
			};

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
									color: '#0000FF',
								}
							};
							Elements.push(EL);
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
							Elements.push(EL);
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
					Elements.push(EL);
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
				Elements.push(EL);
			}
		}
	});

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

	const data = {
		layout: {
			name: 'cose',
			animate: false
		},
		container: $('#NetworkMesh')[0],
		style: StyleSheet,
		elements: Elements
	};

	const Mesh = cytoscape(data);
    Mesh.on('tap','node',LoadData)
}

function LoadData(){

    const Data = $('<ul>');

    // Node
    const Node = $("<li>");
    Node.css({marginBottom:'10px'})
    Node.html("<strong>Node Details</strong>");
    Node.appendTo(Data)

    const NodeDetails = $("<ul>");
    NodeDetails.appendTo(Node);
    $(`<li>ID: ${this.data('id')}</li>`).appendTo(NodeDetails);
    $(`<li>Name: ${this.data('nameOnly')}</li>`).appendTo(NodeDetails);
    $(`<li>Location: ${this.data('location')}</li>`).appendTo(NodeDetails);

    // Supply
    const Battery = $("<li>");
    Battery.css({marginBottom:'10px'})
    Battery.html("<strong>Power Supply</strong>");
    Battery.appendTo(Data)

    const BatteryDetails = $("<ul>");
    BatteryDetails.appendTo(Battery);
    $(`<li>Source: ${this.data('powerSource').type}</li>`).appendTo(BatteryDetails);

    if(this.data('powerSource').type === 'battery'){
        $(`<li>Current Level: ${this.data('powerSource').level}</li>`).appendTo(BatteryDetails);
    }

    // Performance
    const Performance = $("<li>");
    Performance.css({marginBottom:'10px'})
    Performance.html("<strong>Performance</strong>");
    Performance.appendTo(Data)

    const PerformanceDetails = $("<ul>");
    PerformanceDetails.appendTo(Performance);
    $(`<li>Round Trip Time (ms): ${this.data('statistics').rtt}</li>`).appendTo(PerformanceDetails);
    


    if(this.data('statistics').lwr !== undefined){
        $(`<li>Protocol Data Rate : ${DataRate[this.data('statistics').lwr.protocolDataRate]}</li>`).appendTo(PerformanceDetails); 
        $(`<li>ACK RSSI (Received by Controller): ${this.data('statistics').lwr.rssi}</li>`).appendTo(PerformanceDetails); 
    }
    $(`<li>ACK RSSI (Received by Node): ${this.data('statistics').rssi}</li>`).appendTo(PerformanceDetails);




   $("#Details").html(Data);







  
}
