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
	_HTTPAdmin.get(
		`/zwave-js/${_NetworkID}/smartstart-event/started`,
		SendStarted
	);
	_HTTPAdmin.get(
		`/zwave-js/${_NetworkID}/smartstart-event/code/:Code`,
		ParseCode
	);

	_Callback = CTX._SmartStartCallback;
	_Enabled = true;

	const Secure = Req.connection.encrypted !== undefined;
	const Prot = Secure ? 'https://' : 'http://';
	return new Promise((resolve) => {
		resolve(
			`${Prot}${Req.headers.host}/resources/node-red-contrib-zwave-js/SmartStart/Scanchoice.html?net=${_NetworkID}`
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
		const Routes = [];
		_HTTPAdmin._router.stack.forEach((R) => {
			if (R.route === undefined) {
				Routes.push(R);
				return;
			}
			if (
				!R.route.path.startsWith(`/zwave-js/${_NetworkID}/smartstart-event`)
			) {
				Routes.push(R);
				return;
			}
		});

		_HTTPAdmin._router.stack = Routes;

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
