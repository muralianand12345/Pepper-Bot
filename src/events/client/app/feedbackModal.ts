import { Events, WebhookClient, EmbedBuilder } from 'discord.js';
import { BotEvent } from '../../../types';

const event: BotEvent = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {

        if (!interaction.isModalSubmit()) return;

        if (interaction.customId == 'feedback-modal') {
            const webhookClient = new WebhookClient({ url: client.config.bot.feedback });

            const feedbackName: string = interaction.fields.getTextInputValue('feedback-modal-name') || 'Anonymous';
            const feedback: string = interaction.fields.getTextInputValue('feedback-modal-feedback') || 'No feedback provided';

            var embed = new EmbedBuilder()
                .setColor('Blue')
                .setTitle(`Feedback - ${interaction.user.tag}`)
                .addFields(
                    { name: 'User ID', value: `\`${interaction.user.id}\`` },
                    { name: 'Server ID', value: `\`${interaction.guild.id}\`` },
                    { name: 'Client Name', value: `\`${client.user.username}\`` },
                )
                .setFooter({ text: `Submitted by ${feedbackName} || ${interaction.user.tag} (${interaction.user.id})` })
                .setTimestamp();

            if (feedback.length > 1000) {
                const chunks: string[] = feedback.match(/[\s\S]{1,1000}/g) || [];
                chunks.forEach(async (chunk, index) => {
                    let fieldName = index === 0 ? `Feedback (Part ${index + 1})` : `... (Part ${index + 1})`;
                    embed.addFields({ name: fieldName, value: `\`\`\`${chunk}\`\`\`` });
                });
            } else {
                embed.addFields({ name: `Feedback`, value: `\`\`\`${feedback}\`\`\`` });
            }

            await webhookClient.send({ embeds: [embed] });

            const replyEmbed = new EmbedBuilder()
                .setColor('Blue')
                .setDescription(`Thank you for your feedback!`);

            await interaction.reply({ embeds: [replyEmbed], ephemeral: true });

        }
    }
}

export default event;