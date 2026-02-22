const { getValueDB } = require('./Fetchers');
const { invokeMethod } = require('./Invoker');

const process = async function (DriverInstance, Method, Args) {
	if (Method === 'getValueDB') {
		try {
			return getValueDB(DriverInstance, Args);
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	/* Dynamic */
	return invokeMethod(DriverInstance, Method, Args)

};

module.exports = { process };
