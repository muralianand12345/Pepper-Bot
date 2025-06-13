"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequester = exports.wait = exports.sendTempMessage = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const promises_1 = __importDefault(require("timers/promises"));
const sendTempMessage = async (channel, embed, duration = 10000) => {
    if (!channel.isTextBased())
        throw new Error('Channel is not text-based');
    const message = await channel.send({ embeds: [embed] }).catch((error) => {
        if (error.code === 50001)
            return null;
        return null;
    });
    if (!message)
        return;
    setTimeout(() => {
        message.delete().catch((deleteError) => {
            if (deleteError.code !== 10008) {
            }
        });
    }, duration);
};
exports.sendTempMessage = sendTempMessage;
const wait = async (ms) => {
    await promises_1.default.setTimeout(ms);
};
exports.wait = wait;
const getRequester = (client, user) => {
    if (!user)
        return null;
    if (typeof user === 'string') {
        const cachedUser = client.users.cache.get(user);
        if (cachedUser)
            user = cachedUser;
        else
            return { id: user, username: 'Unknown', discriminator: '0000', avatar: undefined };
    }
    if (user instanceof discord_js_1.default.ClientUser)
        return { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatar || undefined };
    if (user instanceof discord_js_1.default.User)
        return { id: user.id, username: user.username, discriminator: user.discriminator, avatar: user.avatarURL() || undefined };
    return { id: user, username: 'Unknown', discriminator: '0000', avatar: undefined };
};
exports.getRequester = getRequester;
