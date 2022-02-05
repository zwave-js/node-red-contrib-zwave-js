let _Callback;
let _HTTPAdmin

const Start = (Callback,Req,HTTPAdmin) => {
	_Callback = Callback;
	_HTTPAdmin = HTTPAdmin;

	HTTPAdmin.get('/zwave-js/smartstart-event/started',SendStarted)
	HTTPAdmin.get('/zwave-js/smartstart-event/code/:Code',ParseCode)
	
	const Secure = Req.connection.encrypted !== undefined
	const Prot = Secure ? 'https://' : 'http://';
	return new Promise((resolve) => {
		resolve(`${Prot}${Req.headers.host}/resources/node-red-contrib-zwave-js/SmartStart/Scanchoice.html`)
	});
};

function SendStarted(req, res) {
	_Callback('Started');
	res.status(200);
	res.end();
}

function ParseCode(req, res) {
	const Result = _Callback('Code', req.params.Code);
	res.status(200);
	res.end(Result.toString());
}

const Stop = () => {

	_HTTPAdmin.get('/zwave-js/smartstart-event/started',(req,res) => res.sendStatus(404).end())
	_HTTPAdmin.get('/zwave-js/smartstart-event/code/:Code',(req,res) => res.sendStatus(404).end())
};

module.exports = {
	Start: Start,
	Stop: Stop
};
