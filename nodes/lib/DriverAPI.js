const { getValueDB } = require('./Fetchers');
const { invokeMethod } = require('./Invoker');

const process = async function (DriverInstance, Method, Args) {
	if (Method === 'getValueDB') {
		return getValueDB(DriverInstance, Args);
	}

	/* Dynamic */
	return invokeMethod(DriverInstance, Method, Args || [])

};

module.exports = { process };
