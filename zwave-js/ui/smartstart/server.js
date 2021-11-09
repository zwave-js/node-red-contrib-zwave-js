const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const ip = require('ip');

let App;
let Server;
let _Callback;

const Options = {
	pfx: fs.readFileSync(path.join(__dirname, 'certificate.p12')),
	passphrase: 'password1'
};

const Start = (Callback) => {

	_Callback = Callback;
	App = express();
	App.use(express.static(path.join(__dirname, 'ui')));
	App.get('/event.started', SendStarted);
	App.get('/event.code/:Code', ParseCode);
	Server = https.createServer(Options, App);

	return new Promise((resolve) => {
		Server.listen(0, () => {
			resolve(
				'https://' + ip.address() + ':' + Server.address().port + '/scan.html'
			);
		});
	});
};

function SendStarted(req, res) {
	_Callback('Started');
	res.status(200);
	res.end();
}

function ParseCode(req, res) {
	_Callback('Code',req.params.Code);
	res.status(200);
	res.end();
	// pasre and pass back
}

const Stop = () => {
	Server.close();
	Server = undefined;
	App = undefined;
};

module.exports = {
	Start: Start,
	Stop: Stop
};
