"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUserPremium = void 0;
const checkUserPremium = async (client, userId) => {
    const supportGuildId = client.config.bot.support_server.id;
    const localGuild = client.guilds.cache.get(supportGuildId);
    if (localGuild) {
        const member = await localGuild.members.fetch(userId).catch(() => null);
        return member ? { isPremium: true, tier: 1 } : { isPremium: false, tier: 0 };
    }
    if (!client.shard)
        return { isPremium: false, tier: 0 };
    const results = await client.shard
        .broadcastEval(async (c, context) => {
        const guild = c.guilds.cache.get(context.guildId);
        if (!guild)
            return false;
        const member = await guild.members.fetch(context.userId).catch(() => null);
        return member !== null;
    }, { context: { guildId: supportGuildId, userId } })
        .catch((error) => {
        client.logger?.warn(`[PREMIUM] Failed to resolve support server membership across shards: ${error}`);
        return [];
    });
    return results.some(Boolean) ? { isPremium: true, tier: 1 } : { isPremium: false, tier: 0 };
};
exports.checkUserPremium = checkUserPremium;
