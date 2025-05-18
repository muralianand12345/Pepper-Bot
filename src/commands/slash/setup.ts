import discord from "discord.js";
import music_guild from "../../events/database/schema/music_guild";
import { MusicResponseHandler, MusicChannelManager } from "../../utils/music/embed_template";
import { SlashCommand } from "../../types";

const setupCommand: SlashCommand = {
    cooldown: 10,
    dj: true,
    data: new discord.SlashCommandBuilder()
        .setName("setup")
        .setDescription("Setup music bot in the server")
        .setContexts(discord.InteractionContextType.Guild)
        .addStringOption(option =>
            option.setName("prefix")
                .setDescription("Prefix for the music bot")
                .setRequired(false)
        )
        .addChannelOption(option =>
            option.setName("music_channel")
                .setDescription("Music channel for the bot")
                .setRequired(false)
                .addChannelTypes(discord.ChannelType.GuildText)
        ),
    execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client) => {
        if (!client.config.music.enabled) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "Music is currently disabled"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        if (client.config.bot.command.disable_message) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "This command is disabled"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        if (!interaction.guild) {
            return await interaction.reply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "This command can only be used in a server"
                    ),
                ],
                flags: discord.MessageFlags.Ephemeral,
            });
        }

        const prefix = interaction.options.getString("prefix");
        const musicChannel = interaction.options.getChannel("music_channel");

        if (!prefix && !musicChannel) {
            return await showCurrentConfig(interaction, client);
        }

        await interaction.deferReply();

        try {
            let guildData = await music_guild.findOne({ guildId: interaction.guild.id });

            if (!guildData) {
                guildData = new music_guild({
                    guildId: interaction.guild.id,
                    prefix: client.config.bot.command.prefix,
                    songChannelId: null,
                    songs: []
                });
            }

            if (prefix) {
                guildData.prefix = prefix;
            }

            if (musicChannel) {
                guildData.songChannelId = musicChannel.id;
                const musicChannelManager = new MusicChannelManager(client);
                const music_pannel_message = await musicChannelManager.createMusicEmbed(musicChannel);
                guildData.musicPannelId = music_pannel_message?.id || null;
                client.logger.info(
                    `[SETUP] Initialized music channel embed in #${musicChannel.name} (${musicChannel.id})`
                );
            }

            await guildData.save();

            const embed = new discord.EmbedBuilder()
                .setColor("#43b581")
                .setTitle("✅ Bot Configuration Updated")
                .setDescription("Setup completed successfully!")
                .addFields([
                    {
                        name: "Prefix",
                        value: `\`${guildData.prefix}\``,
                        inline: true
                    },
                    {
                        name: "Music Channel",
                        value: guildData.songChannelId ? `<#${guildData.songChannelId}>` : "Not set",
                        inline: true
                    }
                ])
                .setFooter({
                    text: `Setup by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            client.logger.info(
                `[SETUP] Updated configuration for guild ${interaction.guild.name} (${interaction.guild.id}): ` +
                `Prefix: ${guildData.prefix}, Music Channel: ${guildData.songChannelId}`
            );
        } catch (error) {
            client.logger.error(`[SETUP] Error updating configuration: ${error}`);

            await interaction.editReply({
                embeds: [
                    new MusicResponseHandler(client).createErrorEmbed(
                        "An error occurred while updating the configuration. Please try again later.",
                        true
                    ),
                ],
                components: [
                    new MusicResponseHandler(client).getSupportButton(),
                ],
            });
        }
    }
};

const showCurrentConfig = async (
    interaction: discord.ChatInputCommandInteraction,
    client: discord.Client
): Promise<void> => {
    await interaction.deferReply();

    try {
        const guildData = await music_guild.findOne({ guildId: interaction.guild?.id });
        const prefix = guildData?.prefix || client.config.bot.command.prefix;
        const songChannelId = guildData?.songChannelId || null;

        const embed = new discord.EmbedBuilder()
            .setColor("#5865f2")
            .setTitle("⚙️ Current Bot Configuration")
            .addFields([
                {
                    name: "Prefix",
                    value: `\`${prefix}\``,
                    inline: true
                },
                {
                    name: "Music Channel",
                    value: songChannelId ? `<#${songChannelId}>` : "Not set",
                    inline: true
                }
            ])
            .setDescription(
                "To update settings, use the command with options:\n" +
                `\`/setup prefix:<prefix> music_channel:#channel\``
            )
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        client.logger.error(`[SETUP] Error retrieving configuration: ${error}`);

        await interaction.editReply({
            embeds: [
                new MusicResponseHandler(client).createErrorEmbed(
                    "An error occurred while retrieving the configuration.",
                    true
                ),
            ],
            components: [
                new MusicResponseHandler(client).getSupportButton(),
            ],
        });
    }
};

export default setupCommand;