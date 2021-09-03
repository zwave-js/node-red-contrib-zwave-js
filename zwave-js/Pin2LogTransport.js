const WinstonTransport = require('winston-transport');

let _CallBack = undefined;

class Pin2LogTransport extends WinstonTransport {
	constructor(options) {
		_CallBack = options.callback;
		delete options.callback;
		super(options);
	}
}

Pin2LogTransport.prototype.log = function (info, next) {
	if (_CallBack !== undefined) {
		_CallBack(info);
	}
	next();
};

Pin2LogTransport.close = function () {
	_CallBack = undefined;
};

module.exports = {
	Pin2LogTransport: Pin2LogTransport
};
