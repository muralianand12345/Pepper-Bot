"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ms_1 = __importDefault(require("ms"));
const discord_js_1 = __importDefault(require("discord.js"));
const commands_1 = require("../core/commands");
const v2_1 = require("../utils/v2");
const user_ban_1 = __importDefault(require("../events/database/schema/user_ban"));
const banCommand = {
    owner: true,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from using the bot')
        .addUserOption((option) => option.setName('user').setDescription('The user to ban').setRequired(true))
        .addStringOption((option) => option.setName('reason').setDescription('Why the user is being banned').setMaxLength(500).setRequired(true))
        .addStringOption((option) => option.setName('duration').setDescription('How long the ban lasts, e.g. 7d or 12h (leave empty for permanent)').setRequired(false))
        .setDefaultMemberPermissions(0)
        .setContexts(discord_js_1.default.InteractionContextType.Guild),
    execute: async (interaction, client) => {
        const user = interaction.options.getUser('user', true);
        const reason = interaction.options.getString('reason', true);
        const duration = interaction.options.getString('duration');
        if (user.id === interaction.user.id || client.config.bot.owners.includes(user.id))
            return await interaction.reply((0, v2_1.v2Ephemeral)((0, v2_1.panel)(0xed4245, { body: '❌ Bot owners cannot be banned.' })));
        const durationMs = duration ? (0, ms_1.default)(duration) : null;
        if (duration && (typeof durationMs !== 'number' || durationMs <= 0))
            return await interaction.reply((0, v2_1.v2Ephemeral)((0, v2_1.panel)(0xed4245, { body: `❌ Invalid duration \`${duration}\`. Use formats like \`30m\`, \`12h\` or \`7d\`.` })));
        const expiresAt = durationMs ? new Date(Date.now() + durationMs) : null;
        await user_ban_1.default.findOneAndUpdate({ userId: user.id }, { reason, bannedBy: interaction.user.id, expiresAt }, { upsert: true, setDefaultsOnInsert: true });
        (0, commands_1.clearUserBanCache)(user.id);
        client.logger.info(`[BAN] ${interaction.user.tag} banned ${user.tag} (${user.id}) ${expiresAt ? `until ${expiresAt.toISOString()}` : 'permanently'}: ${reason}`);
        return await interaction.reply((0, v2_1.v2Ephemeral)((0, v2_1.panel)(0xed4245, {
            title: '🚫 User banned',
            body: (0, v2_1.fields)([
                ['User', `${user} (\`${user.id}\`)`],
                ['Reason', reason],
                ['Expires', expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:F> (<t:${Math.floor(expiresAt.getTime() / 1000)}:R>)` : 'Never'],
            ]),
            timestamp: true,
        })));
    },
};
exports.default = banCommand;
