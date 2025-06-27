const { getValueDB } = require('./Fetchers');

const process = async function (DriverInstance, Method, Args) {
	if (Method === 'hardReset') {
		return DriverInstance.hardReset();
	}

	if (Method === 'getValueDB') {
		try {
			return getValueDB(DriverInstance, Args);
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	return Promise.reject(new Error('Invalid Method'));
};

module.exports = { process };
