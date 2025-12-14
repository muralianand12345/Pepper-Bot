"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.send = void 0;
const send = async (client, channelId, message) => {
    return client.shard
        ?.broadcastEval(async (c, context) => {
        const channel = c.channels.cache.get(context.channelId);
        if (channel?.isSendable()) {
            await channel.send(context.message);
            return true;
        }
        return false;
    }, { context: { channelId, message } })
        .then((results) => results.some((result) => result === true))
        .catch(() => false);
};
exports.send = send;
