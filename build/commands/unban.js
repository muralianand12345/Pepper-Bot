"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const commands_1 = require("../core/commands");
const v2_1 = require("../utils/v2");
const user_ban_1 = __importDefault(require("../events/database/schema/user_ban"));
const unbanCommand = {
    owner: true,
    data: new discord_js_1.default.SlashCommandBuilder()
        .setName('unban')
        .setDescription('Lift a user ban from the bot')
        .addUserOption((option) => option.setName('user').setDescription('The user to unban').setRequired(true))
        .setDefaultMemberPermissions(0)
        .setContexts(discord_js_1.default.InteractionContextType.Guild),
    execute: async (interaction, client) => {
        const user = interaction.options.getUser('user', true);
        const ban = await user_ban_1.default.findOneAndDelete({ userId: user.id });
        (0, commands_1.clearUserBanCache)(user.id);
        if (!ban)
            return await interaction.reply((0, v2_1.v2Ephemeral)((0, v2_1.panel)(0xfee75c, { body: `⚠️ ${user} is not banned.` })));
        client.logger.info(`[BAN] ${interaction.user.tag} unbanned ${user.tag} (${user.id})`);
        return await interaction.reply((0, v2_1.v2Ephemeral)((0, v2_1.panel)(0x57f287, {
            title: '✅ User unbanned',
            body: (0, v2_1.fields)([
                ['User', `${user} (\`${user.id}\`)`],
                ['Previous reason', ban.reason],
            ]),
            timestamp: true,
        })));
    },
};
exports.default = unbanCommand;
