const fs = require('fs');

const CPs = [
	{ source: './node_modules/mermaid', target: './resources/Mermaid' },
	{ source: './node_modules/qr-scanner', target: './resources/QRS' },
	{ source: './node_modules/svg-pan-zoom', target: './resources/SVGZ' },
	{ source: './node_modules/handlebars', target: './resources/HB' }
];

CPs.forEach((v) => {
	if (!fs.existsSync(v.target)) {
		fs.mkdirSync(v.target);
	}
	fs.cpSync(v.source, v.target, { recursive: true });
});
