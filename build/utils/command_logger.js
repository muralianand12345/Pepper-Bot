"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const discord_js_1 = __importDefault(require("discord.js"));
/**
 * Class responsible for logging Discord bot command executions.
 * Handles both file-based logging and Discord channel logging with embeds.
 */
class CommandLogger {
    constructor(logsPath = "../../logs") {
        this.logFilePath = path_1.default.join(__dirname, logsPath, "bot-user-log.log");
        this.ensureLogDirectory();
    }
    ensureLogDirectory() {
        const directory = path_1.default.dirname(this.logFilePath);
        if (!fs_1.default.existsSync(directory))
            fs_1.default.mkdirSync(directory, { recursive: true });
    }
    getCurrentTimestamp() {
        const now = new Date();
        return `[${now.toISOString()}]`;
    }
    writeToLogFile(logMessage) {
        const logWithoutColor = logMessage.replace(/\x1b\[[0-9;]*m/g, "");
        fs_1.default.appendFileSync(this.logFilePath, logWithoutColor + "\n", "utf8");
    }
    async createLogEmbed(options) {
        const { client, user, commandName, guild, channel } = options;
        const embed = new discord_js_1.default.EmbedBuilder()
            .setColor("Green")
            .setAuthor({ name: "Command Log" })
            .setTimestamp()
            .addFields({ name: "User", value: user ? `${user.tag} (<@${user.id}>)` : "N/A" }, { name: "Command", value: commandName || "N/A" });
        if (!guild) {
            embed.addFields({ name: "Guild", value: "DM" });
        }
        else {
            const botGuildNickname = await client.guilds.cache.get(guild.id)?.members.fetch(client.user.id).then((member) => member.displayName).catch(() => "N/A");
            embed.addFields({ name: "Guild", value: `${guild.name} (${guild.id})` }, { name: "Bot Nickname", value: `${botGuildNickname}` });
        }
        if (!channel) {
            embed.addFields({ name: "Channel", value: "DM" });
        }
        else {
            embed.addFields({ name: "Channel", value: `${channel.name} (<#${channel.id}>)` });
        }
        return embed;
    }
    createLogMessage(options) {
        const { user, commandName, guild, channel } = options;
        return `${this.getCurrentTimestamp()} '[COMMAND]' ${user?.tag} (${user?.id}) used command ${commandName || "N/A"} in ${guild ? guild.name : "DM"} [#${channel ? channel.name : "DM"}]`;
    }
    async log(options) {
        const { client, user, commandName } = options;
        if (!client?.config?.bot?.log?.command)
            return client.logger.error("[COMMAND_LOG] Missing log channel configuration");
        if (!user)
            client.logger.error(`[COMMAND_LOG] User is undefined! ${commandName}`);
        const logChannel = client.channels.cache.get(client.config.bot.log.command.toString());
        if (!logChannel || !(logChannel instanceof discord_js_1.default.TextChannel))
            return client.logger.error(`[COMMAND_LOG] Invalid log channel: ${client.config.bot.log.command}`);
        const logMessage = this.createLogMessage(options);
        this.writeToLogFile(logMessage);
        const embed = await this.createLogEmbed(options);
        logChannel.send({ embeds: [embed] }).catch((error) => client.logger.error(`[COMMAND_LOG] Send error: ${error}`));
    }
}
exports.default = CommandLogger;
