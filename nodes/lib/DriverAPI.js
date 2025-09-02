const { getValueDB } = require('./Fetchers');

const process = async function (DriverInstance, Method, Args) {
	if (Method === 'getValueDB') {
		try {
			return getValueDB(DriverInstance, Args);
		} catch (Err) {
			return Promise.reject(Err);
		}
	}

	/* Dynamic */

	const _Method = DriverInstance[Method];
	if (!_Method) {
		return Promise.reject(new Error('Invalid Method'));
	}
	const Params = Args || [];
	return _Method.apply(DriverInstance, Params);
};

module.exports = { process };
