import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from "discord.js";
import { SlashCommand } from "../../types";


const dcbotcommand: SlashCommand = {
    cooldown: 5000,
    owner: false,
    userPerms: ['Administrator'],
    botPerms: [],
    data: new SlashCommandBuilder()
        .setName('dcbot')
        .setDescription('Disconnects bot from all vc.'),
    execute: async (interaction, client) => {

        if (!interaction.guild) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("This command can only be used in server")],
                ephemeral: true,
            });
        }

        const player = client.manager.get(interaction.guild.id);
        if (!player) {
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('Red').setDescription("There is no active player!")],
                ephemeral: true,
            });
        }

        player.destroy();
        await interaction.reply({
            embeds: [new EmbedBuilder().setColor(client.config.music.embedcolor).setDescription("Disconnected bot from all vc.")],
        });
    }
}

export default dcbotcommand;