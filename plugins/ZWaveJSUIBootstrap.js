const { CommandClasses, isApplicationCC } = require('@zwave-js/core');
const { Driver, getAPI, getCCValues } = require('zwave-js');
const fs = require('fs');
const path = require('path');

const resolveDep = (depName) => {
	const local = path.join(__dirname, '../node_modules', depName);
	const global = path.join(__dirname, '../../../node_modules', depName);
	if (fs.existsSync(local)) return local;
	if (fs.existsSync(global)) return global;
	return undefined;
};

const copyDep = (depName, targetFolder) => {
	const src = resolveDep(depName);
	if (!src) {
		return;
	}
	if (!fs.existsSync(targetFolder)) {
		fs.mkdirSync(targetFolder, { recursive: true });
	}
	fs.cpSync(src, targetFolder, { recursive: true });
};

module.exports = function (RED) {
	const init = () => {
		const dependencies = [
			{ name: 'mermaid', target: path.join(__dirname, '../resources/Mermaid') },
			{ name: 'qr-scanner', target: path.join(__dirname, '../resources/QRS') },
			{ name: 'svg-pan-zoom', target: path.join(__dirname, '../resources/SVGZ') },
			{ name: 'handlebars', target: path.join(__dirname, '../resources/HB') }
		];

		dependencies.forEach((dep) => copyDep(dep.name, dep.target));

		const CCList = {};
		const CCProps = [];

		RED.httpAdmin.get(
			'/zwave-js/ui/global/getccmethods/:cc',
			RED.auth.needsPermission('flows.write'),
			(request, response) => {
				if (CCList[request.params.cc]) {
					response.json({ callSuccess: true, response: CCList[request.params.cc] });
				} else {
					response.json({ callSuccess: true, response: [] });
				}
			}
		);

		RED.httpAdmin.get(
			'/zwave-js/ui/global/getccproperties/:cc',
			RED.auth.needsPermission('flows.write'),
			(request, response) => {
				if (CCProps[request.params.cc]) {
					response.json({ callSuccess: true, response: CCProps[request.params.cc] });
				} else {
					response.json({ callSuccess: true, response: [] });
				}
			}
		);

		RED.httpAdmin.get('/zwave-js/ui/global/getcclist', RED.auth.needsPermission('flows.write'), (_, response) => {
			try {
				if (!Object.keys(CCList).length) {
					Object.keys(CommandClasses).forEach((CC) => {
						if (isApplicationCC(CommandClasses[CC])) {
							const API = getAPI(CommandClasses[CC]);
							if (API !== undefined) {
								const Methods = Object.getOwnPropertyNames(API.prototype).filter(
									(m) => m !== 'constructor' && m !== 'supportsCommand'
								);
								CCList[CC] = Methods;

								const Props = getCCValues(CommandClasses[CC]);
								if (typeof Props === 'object') {
									const Keys = Object.keys(Props);
									const PropsArray = [];
									Keys.forEach((PK) => {
										const Prop = Props[PK];
										if (typeof Prop === 'object') {
											if (Prop.id) {
												const VID = {
													comandClass: Prop.id.commandClass,
													property: Prop.id.property,
													propertyKey: Prop.id.propertyKey
												};
												PropsArray.push(VID);
											}
										}
									});
									CCProps[CC] = PropsArray;
								}
							}
						}
					});
				}
				response.json({ callSuccess: true, response: Object.keys(CCList) });
			} catch (Err) {
				console.log(Err);
				response.json({ callSuccess: false, response: Err });
			}
		});

		RED.httpAdmin.get('/zwave-js/ui/global/getports', RED.auth.needsPermission('flows.write'), (_, response) => {
			Driver.enumerateSerialPorts()
				.then((data) => {
					response.json({ callSuccess: true, response: data });
				})
				.catch((Error) => {
					response.json({ callSuccess: false, response: Error.message });
				});
		});
	};

	RED.plugins.registerPlugin('zwavejs-uibootstrap', {
		onadd: init
	});
};
