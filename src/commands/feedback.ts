import discord from "discord.js";

import { Command } from "../types";
import { ConfigManager } from "../utils/config";
import { MusicResponseHandler } from "../core/music";
import { LocalizationManager, LocaleDetector } from "../core/locales";


const configManager = ConfigManager.getInstance();
const localizationManager = LocalizationManager.getInstance();
const localeDetector = new LocaleDetector();

const feedbackCommand: Command = {
    cooldown: 30,
    data: new discord.SlashCommandBuilder()
        .setName("feedback")
        .setDescription("Send feedback to the developers")
        .setNameLocalizations(localizationManager.getCommandLocalizations('commands.feedback.name'))
        .setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.feedback.description')),

    modal: async (interaction: discord.ModalSubmitInteraction): Promise<void> => {
        const t = await localeDetector.getTranslator(interaction);
        const locale = await localeDetector.detectLocale(interaction);
        const responseHandler = new MusicResponseHandler(interaction.client);

        try {
            const feedbackText = interaction.fields.getTextInputValue("feedback_input");
            const feedbackType = interaction.fields.getTextInputValue("feedback_type");

            const webhookUrl = configManager.getFeedbackWebhook();
            const webhook = new discord.WebhookClient({ url: webhookUrl });

            const embed = new discord.EmbedBuilder()
                .setColor("#5865f2")
                .setTitle("📝 New Feedback Received")
                .setDescription(`**Type:** ${feedbackType}\n**Feedback:**\n${feedbackText}`)
                .addFields([
                    { name: "User", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                    { name: "Guild", value: interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : "Direct Message", inline: true },
                    { name: "Timestamp", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                ])
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: "Feedback System", iconURL: interaction.client.user?.displayAvatarURL() })
                .setTimestamp();

            await webhook.send({ content: `Feedback from ${interaction.user.tag} (${interaction.user.id})`, embeds: [embed], username: "Feedback Bot", avatarURL: interaction.client.user?.displayAvatarURL() });
            const successEmbed = responseHandler.createSuccessEmbed(t('responses.feedback.sent'), locale);
            await interaction.reply({ embeds: [successEmbed], flags: discord.MessageFlags.Ephemeral });

        } catch (error) {
            interaction.client.logger.error(`[FEEDBACK] Error sending feedback: ${error}`);
            const errorEmbed = responseHandler.createErrorEmbed(t('responses.errors.feedback_failed'), locale, true);
            if (!interaction.replied) {
                await interaction.reply({ embeds: [errorEmbed], flags: discord.MessageFlags.Ephemeral });
            } else {
                await interaction.followUp({ embeds: [errorEmbed], flags: discord.MessageFlags.Ephemeral });
            }
        }
    },

    execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
        const t = await localeDetector.getTranslator(interaction);

        const modal = new discord.ModalBuilder()
            .setCustomId("feedback_modal")
            .setTitle(t('modals.feedback.title'));

        const feedbackTypeInput = new discord.TextInputBuilder()
            .setCustomId("feedback_type")
            .setLabel(t('modals.feedback.type_label'))
            .setPlaceholder(t('modals.feedback.type_placeholder'))
            .setStyle(discord.TextInputStyle.Short)
            .setMaxLength(50)
            .setRequired(true);

        const feedbackInput = new discord.TextInputBuilder()
            .setCustomId("feedback_input")
            .setLabel(t('modals.feedback.feedback_label'))
            .setPlaceholder(t('modals.feedback.feedback_placeholder'))
            .setStyle(discord.TextInputStyle.Paragraph)
            .setMaxLength(1000)
            .setRequired(true);

        const firstRow = new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(feedbackTypeInput);
        const secondRow = new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(feedbackInput);

        modal.addComponents(firstRow, secondRow);

        await interaction.showModal(modal);
    }
};

export default feedbackCommand;