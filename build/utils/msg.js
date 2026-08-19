"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMessage = exports.editMessage = exports.sendRef = exports.send = void 0;
const sendLocal = async (client, channelId, message) => {
    const channel = client.channels.cache.get(channelId);
    if (!channel?.isSendable())
        return null;
    return channel.send(message).catch((error) => {
        client.logger?.warn(`[SEND] Failed to send to channel ${channelId}: ${error}`);
        return null;
    });
};
const sendRemote = async (client, channelId, message) => {
    if (!client.shard)
        return null;
    const results = await client.shard
        .broadcastEval(async (c, context) => {
        const channel = c.channels.cache.get(context.channelId);
        if (channel?.isSendable()) {
            const msg = await channel.send(context.message);
            return { found: true, messageId: msg.id, channelId: msg.channelId, guildId: msg.guildId };
        }
        return { found: false };
    }, { context: { channelId, message } })
        .catch((error) => {
        client.logger?.warn(`[SEND] Broadcast send failed for channel ${channelId}: ${error}`);
        return [{ found: false }];
    });
    const success = results.find((r) => r.found);
    if (!success)
        return null;
    return { messageId: success.messageId, channelId: success.channelId, local: false };
};
/**
 * Sends a message to a channel, resolving it on whichever shard owns it.
 * Returns a live Message only when the channel belongs to the current shard;
 * for a channel owned by a sibling shard the message is still delivered but
 * null is returned, since a Message cannot cross the process boundary.
 * Use sendRef/editMessage/deleteMessage when the result must be acted on.
 */
const send = async (client, channelId, message) => {
    const local = await sendLocal(client, channelId, message);
    if (local)
        return local;
    if (!client.shard)
        return null;
    await sendRemote(client, channelId, message);
    return null;
};
exports.send = send;
/** Sends a message and returns a shard-agnostic reference usable with editMessage/deleteMessage. */
const sendRef = async (client, channelId, message) => {
    const local = await sendLocal(client, channelId, message);
    if (local)
        return { messageId: local.id, channelId: local.channelId, local: true };
    if (!client.shard)
        return null;
    return sendRemote(client, channelId, message);
};
exports.sendRef = sendRef;
const editMessage = async (client, channelId, messageId, payload) => {
    const channel = client.channels.cache.get(channelId);
    if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message?.editable)
            return false;
        return message.edit(payload).then(() => true, () => false);
    }
    if (!client.shard)
        return false;
    const results = await client.shard
        .broadcastEval(async (c, context) => {
        const target = c.channels.cache.get(context.channelId);
        if (!target?.isTextBased())
            return false;
        const message = await target.messages.fetch(context.messageId).catch(() => null);
        if (!message?.editable)
            return false;
        return message.edit(context.payload).then(() => true, () => false);
    }, { context: { channelId, messageId, payload } })
        .catch(() => []);
    return results.some(Boolean);
};
exports.editMessage = editMessage;
const deleteMessage = async (client, channelId, messageId) => {
    const channel = client.channels.cache.get(channelId);
    if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (!message)
            return false;
        return message.delete().then(() => true, () => false);
    }
    if (!client.shard)
        return false;
    const results = await client.shard
        .broadcastEval(async (c, context) => {
        const target = c.channels.cache.get(context.channelId);
        if (!target?.isTextBased())
            return false;
        const message = await target.messages.fetch(context.messageId).catch(() => null);
        if (!message)
            return false;
        return message.delete().then(() => true, () => false);
    }, { context: { channelId, messageId } })
        .catch(() => []);
    return results.some(Boolean);
};
exports.deleteMessage = deleteMessage;
