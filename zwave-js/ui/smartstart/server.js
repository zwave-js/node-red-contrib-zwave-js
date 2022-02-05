let _Callback;
let _HTTPAdmin;
let _Enabled = false;

const Prep = (HTTPAdmin) => {
	HTTPAdmin.get('/zwave-js/smartstart-event/started', SendStarted);
	HTTPAdmin.get('/zwave-js/smartstart-event/code/:Code', ParseCode);

	_HTTPAdmin;
};

const CheckStatus = (res) => {
	if (_Enabled) {
		return true;
	} else {
		res.sendStatus(503).end();
		return false;
	}
};

const Start = (Callback, Req) => {
	_Callback = Callback;
	_Enabled = true;

	const Secure = Req.connection.encrypted !== undefined;
	const Prot = Secure ? 'https://' : 'http://';
	return new Promise((resolve) => {
		resolve(
			`${Prot}${Req.headers.host}/resources/node-red-contrib-zwave-js/SmartStart/Scanchoice.html`
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
	_Enabled = false;
};

module.exports = {
	Start: Start,
	Stop: Stop,
	Prep: Prep
};
