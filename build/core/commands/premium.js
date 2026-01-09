"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUserPremium = void 0;
const checkUserPremium = async (client, userId) => {
    const guild = client.guilds.cache.get(client.config.bot.support_server.id);
    if (!guild)
        return { isPremium: false, tier: 0 };
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member)
        return { isPremium: false, tier: 0 };
    return { isPremium: true, tier: 1 };
};
exports.checkUserPremium = checkUserPremium;
