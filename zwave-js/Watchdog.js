const SP = require('serialport').SerialPort;
const FS = require('fs');

class Watchdog {
	constructor(Serialport, Callback) {
		this._serialport = Serialport;
		this._CB = Callback;
		this._HeartBeat = setInterval(() => this.Check(), 5000);
	}

	Check() {
		SP.list().then((Ps) => {
			if (Ps.filter((P) => P.path === this._serialport).length === 0) {
				if (!FS.existsSync(this._serialport)) {
					clearInterval(this._HeartBeat);
					this._CB(false);
					this._HeartBeat = setInterval(() => this.Recover(), 5000);
				}
			}
		});
	}

	Recover() {
		SP.list().then((Ps) => {
			if (Ps.filter((P) => P.path === this._serialport).length > 0) {
				clearInterval(this._HeartBeat);
				this._CB(true);
			} else if (FS.existsSync(this._serialport)) {
				clearInterval(this._HeartBeat);
				this._CB(true);
			}
		});
	}
}

module.exports = {
	Watchdog: Watchdog
};
