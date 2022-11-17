"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Type_ZWaveJSRuntime_1 = require("../types/Type_ZWaveJSRuntime");
module.exports = (RED) => {
    const init = function (config) {
        const self = this;
        RED.nodes.createNode(self, config);
        self.config = config;
        self.runtime = RED.nodes.getNode(self.config.runtimeId);
        const callback = (Data) => {
            switch (Data.Type) {
                case Type_ZWaveJSRuntime_1.MessageType.STATUS:
                    self.status(Data.Status);
                    if (Data.Status.clearTime) {
                        setTimeout(() => {
                            self.status({});
                        }, Data.Status.clearTime);
                    }
                    break;
                case Type_ZWaveJSRuntime_1.MessageType.EVENT:
                    self.send({ payload: Data.Event });
                    break;
            }
        };
        self.runtime.registerControllerNode(self.id, callback);
        self.on('close', (_, done) => {
            self.runtime.deregisterControllerNode(self.id);
            done();
        });
        self.on('input', (msg, send, done) => {
            const Payload = msg.payload;
            const TypedAPIString = Payload.api;
            self.runtime.controllerCommand(Type_ZWaveJSRuntime_1.API[TypedAPIString], Payload.method, Payload.params).then((Result) => {
                if (Result && typeof Result !== 'boolean') {
                    Result = Result;
                    switch (Result.Type) {
                        case Type_ZWaveJSRuntime_1.MessageType.EVENT:
                            send({ payload: Result.Event });
                            done();
                            break;
                    }
                }
                else {
                    done();
                }
            });
        });
    };
    RED.nodes.registerType('zwavejs-controller', init);
};
