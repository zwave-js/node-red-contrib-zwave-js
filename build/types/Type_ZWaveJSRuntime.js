"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API = exports.MessageType = void 0;
var MessageType;
(function (MessageType) {
    MessageType[MessageType["STATUS"] = 0] = "STATUS";
    MessageType[MessageType["EVENT"] = 1] = "EVENT";
})(MessageType = exports.MessageType || (exports.MessageType = {}));
var API;
(function (API) {
    API[API["CONTROLLER_API"] = 0] = "CONTROLLER_API";
    API[API["VALUE_API"] = 1] = "VALUE_API";
    API[API["CC_API"] = 2] = "CC_API";
})(API = exports.API || (exports.API = {}));
