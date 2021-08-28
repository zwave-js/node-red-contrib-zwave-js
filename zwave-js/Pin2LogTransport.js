const Stream = require('stream');
const WinstonTransport = require('winston-transport');

class Pin2LogTransport extends WinstonTransport {
	constructor(options) {
		super(options);
		this.formattedMessageSymbol = Symbol.for('message');
		this.passThroughStream = new Stream.PassThrough();
	}
}

Pin2LogTransport.prototype.log = function (info, next) {
	const logObject = JSON.stringify(info);
	this.passThroughStream.write(logObject);
	next();
};

Pin2LogTransport.prototype.getStream = function () {
	return this.passThroughStream;
};

Pin2LogTransport.prototype.destroy = function () {
	this.passThroughStream.end();
	this.passThroughStream.destroy();
};

module.exports = {
	Pin2LogTransport: Pin2LogTransport
};
