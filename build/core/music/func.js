"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequester = exports.isBotRequester = exports.wait = exports.sendTempMessage = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const promises_1 = __importDefault(require("timers/promises"));
const msg_1 = require("../../utils/msg");
const v2_1 = require("../../utils/v2");
const sendTempMessage = async (channel, container, duration = 10000) => {
    if (!channel.isTextBased())
        throw new Error('Channel is not text-based');
    const ref = await (0, msg_1.sendRef)(channel.client, channel.id, (0, v2_1.v2)(container)).catch(() => null);
    if (!ref)
        return;
    setTimeout(() => {
        (0, msg_1.deleteMessage)(channel.client, ref.channelId, ref.messageId).catch(() => { });
    }, duration);
};
exports.sendTempMessage = sendTempMessage;
const wait = async (ms) => {
    await promises_1.default.setTimeout(ms);
};
exports.wait = wait;
const isBotRequester = (client, requester) => {
    const id = typeof requester === 'string' ? requester : requester?.id;
    if (!id)
        return false;
    if (client.user?.id === id)
        return true;
    return client.users.cache.get(id)?.bot ?? false;
};
exports.isBotRequester = isBotRequester;
const getRequester = (client, user) => {
    if (!user)
        return null;
    if (typeof user === 'string') {
        const cachedUser = client.users.cache.get(user);
        if (cachedUser)
            return { id: cachedUser.id, username: cachedUser.username, discriminator: cachedUser.discriminator, avatar: cachedUser.avatarURL() || undefined };
        return { id: user, username: 'Unknown', discriminator: '0000', avatar: undefined };
    }
    if (user instanceof discord_js_1.default.ClientUser)
        return { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatar || undefined };
    if (user instanceof discord_js_1.default.User)
        return { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatarURL() || undefined };
    const { id, username } = (user ?? {});
    if (typeof id !== 'string' || id.length === 0)
        return null;
    return { id, username: username ?? 'Unknown', discriminator: '0000', avatar: undefined };
};
exports.getRequester = getRequester;
