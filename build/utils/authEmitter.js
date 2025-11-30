"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitAuthResult = exports.waitForAuth = exports.authEmitter = void 0;
const events_1 = require("events");
exports.authEmitter = new events_1.EventEmitter();
exports.authEmitter.setMaxListeners(100);
const waitForAuth = (state, timeout) => {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            exports.authEmitter.removeAllListeners(`auth:${state}`);
            resolve('timeout');
        }, timeout);
        exports.authEmitter.once(`auth:${state}`, (data) => {
            clearTimeout(timer);
            resolve(data.status === 'success' ? 'success' : 'failed');
        });
    });
};
exports.waitForAuth = waitForAuth;
const emitAuthResult = (state, status) => exports.authEmitter.emit(`auth:${state}`, { status });
exports.emitAuthResult = emitAuthResult;
