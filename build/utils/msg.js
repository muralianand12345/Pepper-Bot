"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.send = void 0;
const send = async (client, channelId, message) => {
    if (client.shard) {
        const results = await client.shard
            .broadcastEval(async (c, context) => {
            const channel = c.channels.cache.get(context.channelId);
            if (channel?.isSendable()) {
                const msg = await channel.send(context.message);
                return { found: true, messageId: msg.id, channelId: msg.channelId, guildId: msg.guildId };
            }
            return { found: false };
        }, { context: { channelId, message } })
            .catch(() => [{ found: false }]);
        const successResult = results.find((r) => r.found);
        if (successResult) {
            const channel = client.channels.cache.get(successResult.channelId);
            if (channel)
                return channel.messages.fetch(successResult.messageId).catch(() => null);
        }
        return null;
    }
    const channel = client.channels.cache.get(channelId);
    if (channel?.isSendable())
        return channel.send(message);
    return null;
};
exports.send = send;
