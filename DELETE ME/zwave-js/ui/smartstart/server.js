const FS = require('fs');
const path = require('path');

let _Callback;
let _HTTPAdmin;
let _NetworkID;
let _Enabled = false;

const CheckStatus = (res) => {
	if (_Enabled) {
		return true;
	} else {
		res.sendStatus(503).end();
		return false;
	}
};

const Start = (CTX, Req) => {
	_NetworkID = CTX._NetworkIdentifier;
	_HTTPAdmin = CTX._RED.httpAdmin;
	_Callback = CTX._SmartStartCallback;
	_Enabled = true;

	const Secure = Req.connection.encrypted !== undefined;
	const Prot = Secure ? 'https://' : 'http://';
	const Prefix = CTX._RED.settings.httpAdminRoot || '/';

	_HTTPAdmin.get(
		`/zwave-js/${_NetworkID}/smartstart-event/started`,
		SendStarted
	);
	_HTTPAdmin.get(
		`/zwave-js/${_NetworkID}/smartstart-event/code/:Code`,
		ParseCode
	);

	_HTTPAdmin.get(`/zwave-js/smartstart-scanner`, (req, res) => {
		const PageFIle = path.join(
			__dirname,
			'../',
			'../',
			'../',
			'resources',
			'SmartStart',
			'Scan.html'
		);

		const Base = `${Prot}${req.headers.host}${Prefix}resources/node-red-contrib-zwave-js/SmartStart`;

		let Source = FS.readFileSync(PageFIle, 'utf8');
		Source = Source.replace(/{BASE}/g, Base);
		Source = Source.replace(
			/{WS-BASE}/g,
			`${Prot}${req.headers.host}${Prefix}`
		);

		res.contentType('text/html');
		res.send(Source);
	});

	return new Promise((resolve) => {
		resolve(
			`${Prot}${Req.headers.host}${Prefix}zwave-js/smartstart-scanner?net=${_NetworkID}`
		);
	});
};

function SendStarted(req, res) {
	if (CheckStatus(res)) {
		_Callback('Started');
		res.status(200);
		res.end();
	}
}

function ParseCode(req, res) {
	if (CheckStatus(res)) {
		const Result = _Callback('Code', req.params.Code);
		res.status(200);
		res.end(Result.toString());
	}
}

const Stop = () => {
	if (_NetworkID !== undefined) {
		const Check = (Route) => {
			if (Route.route === undefined) {
				return true;
			}
			if (
				!Route.route.path.startsWith(`/zwave-js/smartstart-scanner`) &&
				!Route.route.path.startsWith(`/zwave-js/${_NetworkID}/smartstart-event`)
			) {
				return true;
			}
			return false;
		};

		_HTTPAdmin._router.stack = _HTTPAdmin._router.stack.filter(Check);

		_Enabled = false;
		_Callback = undefined;
		_HTTPAdmin = undefined;
		_NetworkID = undefined;
	}
};

module.exports = {
	Start: Start,
	Stop: Stop
};
