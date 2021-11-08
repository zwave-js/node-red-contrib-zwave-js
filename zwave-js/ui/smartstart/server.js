const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const ip = require('ip');

let App;
let Server;

const Options = {
	pfx: fs.readFileSync(path.join(__dirname, 'certificate.p12')),
	passphrase: 'password1'
};

const Start = () => {
	return new Promise((resolve) => {
		App = express();
		App.use(express.static(path.join(__dirname, 'ui')));
		Server = https.createServer(Options, App);
		Server.listen(0, () => {
			resolve(
				'https://' + ip.address() + ':' + Server.address().port + '/scan.html'
			);
		});
	});
};

const Stop = () => {
	Server.close();
	Server = undefined;
	App = undefined;
};

module.exports = {
	Start: Start,
	Stop: Stop
};
