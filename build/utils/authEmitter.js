"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastAuthResult = exports.registerAuthBridge = exports.emitAuthResult = exports.waitForAuth = exports.authEmitter = exports.AUTH_RESULT_EVENT = void 0;
const events_1 = require("events");
exports.AUTH_RESULT_EVENT = 'pepperAuthResult';
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
const registerAuthBridge = (client) => {
    client.on(exports.AUTH_RESULT_EVENT, (state, status) => (0, exports.emitAuthResult)(state, status));
};
exports.registerAuthBridge = registerAuthBridge;
const broadcastAuthResult = async (client, state, status) => {
    if (!client.shard)
        return void (0, exports.emitAuthResult)(state, status);
    await client.shard
        .broadcastEval((c, context) => {
        c.emit(context.event, context.state, context.status);
    }, { context: { event: exports.AUTH_RESULT_EVENT, state, status } })
        .catch((error) => client.logger?.warn(`[AUTH] Failed to broadcast auth result for ${state}: ${error}`));
};
exports.broadcastAuthResult = broadcastAuthResult;
