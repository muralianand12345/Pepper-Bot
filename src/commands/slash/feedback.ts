import discord from "discord.js";
import { MusicResponseHandler } from "../../utils/music/embed_template";
import { SlashCommand } from "../../types";

const feedbackCommand: SlashCommand = {
    cooldown: 120,
    owner: false,
    data: new discord.SlashCommandBuilder()
        .setName("feedback")
        .setDescription("Send feedback to the bot developers"),
    execute: async (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => {
        const createTextInput = (
            id: string,
            label: string,
            placeholder: string,
            style: discord.TextInputStyle,
            required: boolean
        ): discord.TextInputBuilder => {
            return new discord.TextInputBuilder()
                .setCustomId(id)
                .setLabel(label)
                .setPlaceholder(placeholder)
                .setStyle(style)
                .setRequired(required)
                .setMinLength(
                    style === discord.TextInputStyle.Paragraph ? 10 : 0
                )
                .setMaxLength(
                    style === discord.TextInputStyle.Paragraph ? 4000 : 100
                );
        };

        try {
            const modal = new discord.ModalBuilder()
                .setCustomId("feedback-modal")
                .setTitle(`${client.user?.username} Feedback`);

            const nameInput = createTextInput(
                "feedback-modal-username",
                "Your Name",
                "Leave blank to be anonymous",
                discord.TextInputStyle.Short,
                false
            ); //actually it's not anonymous

            const feedbackInput = createTextInput(
                "feedback-modal-message",
                "Your Feedback",
                "Please describe your feedback, suggestions, or issues...",
                discord.TextInputStyle.Paragraph,
                true
            );

            modal.addComponents(
                new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(
                    nameInput
                ),
                new discord.ActionRowBuilder<discord.TextInputBuilder>().addComponents(
                    feedbackInput
                )
            );

            await interaction.showModal(modal);
        } catch (error) {
            client.logger.error(
                `[FEEDBACK] Failed to open feedback form: ${error}`
            );
            await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Failed to open feedback form. Please try again later.",
                        true
                    ),
                ],
                components: [
                    new MusicResponseHandler(client).getSupportButton(),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }
    },
};

export default feedbackCommand;
