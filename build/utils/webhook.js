"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendChannelWebhook = exports.getChannelWebhook = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const msg_1 = require("./msg");
const NEGATIVE_TTL = 10 * 60 * 1000;
const resolved = new Map();
const failed = new Map();
const inflight = new Map();
const isOwnWebhook = (webhook, client) => {
    if (!webhook.token)
        return false;
    const applicationId = client.application?.id ?? client.user?.id;
    return webhook.application_id === applicationId || webhook.user?.id === client.user?.id;
};
const discover = async (client, channelId) => {
    const existing = (await client.rest.get(discord_js_1.default.Routes.channelWebhooks(channelId)));
    const own = existing.find((webhook) => isOwnWebhook(webhook, client));
    if (own?.token)
        return new discord_js_1.default.WebhookClient({ id: own.id, token: own.token });
    const created = (await client.rest.post(discord_js_1.default.Routes.channelWebhooks(channelId), { body: { name: `${client.user?.username || 'Pepper'} Logs` } }));
    if (!created?.token)
        return null;
    client.logger?.info(`[WEBHOOK] Created log webhook ${created.id} for channel ${channelId}`);
    return new discord_js_1.default.WebhookClient({ id: created.id, token: created.token });
};
const getChannelWebhook = async (client, channelId) => {
    const cached = resolved.get(channelId);
    if (cached)
        return cached;
    const failedAt = failed.get(channelId);
    if (failedAt && Date.now() - failedAt < NEGATIVE_TTL)
        return null;
    const pending = inflight.get(channelId);
    if (pending)
        return pending;
    const attempt = discover(client, channelId)
        .then((webhook) => {
        if (webhook) {
            resolved.set(channelId, webhook);
            failed.delete(channelId);
        }
        else {
            failed.set(channelId, Date.now());
        }
        return webhook;
    })
        .catch((error) => {
        failed.set(channelId, Date.now());
        client.logger?.warn(`[WEBHOOK] Could not resolve a webhook for channel ${channelId}: ${error}`);
        return null;
    })
        .finally(() => inflight.delete(channelId));
    inflight.set(channelId, attempt);
    return attempt;
};
exports.getChannelWebhook = getChannelWebhook;
const sendChannelWebhook = async (client, channelId, payload) => {
    const webhook = await (0, exports.getChannelWebhook)(client, channelId);
    if (webhook) {
        const sent = await webhook.send(payload).then(() => true, (error) => {
            if (error instanceof discord_js_1.default.DiscordAPIError && error.code === 10015)
                resolved.delete(channelId);
            client.logger?.warn(`[WEBHOOK] Failed to send via webhook for channel ${channelId}: ${error}`);
            return false;
        });
        if (sent)
            return true;
    }
    const { username: _username, avatarURL: _avatarURL, threadName: _threadName, withComponents: _withComponents, ...message } = payload;
    return (0, msg_1.send)(client, channelId, message).then((sent) => sent !== null);
};
exports.sendChannelWebhook = sendChannelWebhook;
