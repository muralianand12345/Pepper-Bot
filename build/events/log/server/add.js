"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const event = {
    name: discord_js_1.default.Events.GuildCreate,
    execute: async (guild, client) => {
        const embed = new discord_js_1.default.EmbedBuilder()
            .setTitle("New Server Joined")
            .setAuthor({ name: guild.name, iconURL: guild.iconURL() || "" })
            .setDescription(`I have joined **${guild.name}** (${guild.id}). Now in **${client.guilds.cache.size}** servers.`)
            .addFields({ name: "Members", value: guild.memberCount?.toString() || "Unknown", inline: true }, { name: "Owner", value: guild.ownerId ? `<@${guild.ownerId}>` : "Unknown Owner", inline: true }, { name: "Created", value: guild.createdAt?.toDateString() || "Unknown Date", inline: true })
            .setThumbnail(guild.iconURL() || null)
            .setColor("Green")
            .setFooter({ text: `Now in ${client.guilds.cache.size} servers` })
            .setTimestamp();
        const logChannel = client.channels.cache.get(client.config.bot.log.server);
        if (!logChannel?.isTextBased())
            return client.logger.warn(`[SERVER] Log channel is not a text channel`);
        logChannel.send({ embeds: [embed] });
        client.logger.info(`[SERVER] Joined ${guild.name} (${guild.id})`);
    },
};
exports.default = event;
