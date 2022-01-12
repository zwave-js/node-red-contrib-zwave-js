const { EventEmitter } = require('events');

const EE = new EventEmitter();
EE.setMaxListeners(0);

module.exports = {
	NodeEventEmitter: EE
};
