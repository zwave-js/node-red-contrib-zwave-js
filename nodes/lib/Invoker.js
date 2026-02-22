const invokeMethod = (target, methodName, args = []) => {
    const method = target[methodName];
    if (typeof method !== "function") {
        return Promise.reject(new Error(`Invalid Method: ${methodName}`));
    }
    return method.apply(target, args)
}

module.exports = { invokeMethod };