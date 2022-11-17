"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.process = void 0;
const Fetchers_1 = require("../lib/Fetchers");
const Type_ZWaveJSRuntime_1 = require("../types/Type_ZWaveJSRuntime");
const process = async (DriverInstance, Method, Params) => {
    let Result;
    let Timestamp;
    let Event;
    let Options;
    switch (Method) {
        case 'beginInclusion':
            return new Promise((resolve) => {
                Options = Params?.[0];
                DriverInstance.controller.beginInclusion(Options).then((result) => {
                    resolve(result);
                });
            });
        case 'stopInclusion':
            return new Promise((resolve) => {
                DriverInstance.controller.stopInclusion().then((result) => {
                    resolve(result);
                });
            });
        case 'getValueDB':
            return new Promise((resolve) => {
                Timestamp = new Date().getTime();
                Result = (0, Fetchers_1.getValueDB)(DriverInstance, Params);
                Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: 'VALUE_DB', timestamp: Timestamp, eventBody: Result }
                };
                resolve(Event);
            });
        case 'getNodes':
            return new Promise((resolve) => {
                Timestamp = new Date().getTime();
                Result = (0, Fetchers_1.getNodes)(DriverInstance);
                Event = {
                    Type: Type_ZWaveJSRuntime_1.MessageType.EVENT,
                    Event: { event: 'NODE_LIST', timestamp: Timestamp, eventBody: Result }
                };
                resolve(Event);
            });
        default:
            return undefined;
    }
};
exports.process = process;
