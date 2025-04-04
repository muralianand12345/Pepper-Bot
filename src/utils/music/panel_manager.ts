import discord from "discord.js";
import magmastream from "magmastream";
import music_guild from "../../events/database/schema/music_guild";
import { musicEmbed, setupMusicChannelEmbed } from "./embed_template";

/**
 * MusicPanelManager is responsible for managing the music panel in a Discord guild.
 * It handles the creation, updating, and resetting of the music panel message.
 * It also ensures that the panel is recreated if it is deleted or not found.
 * This class is a singleton, meaning only one instance can exist for each guild.
 * It uses a Map to store instances for each guild, identified by their guild ID.
 * The class is initialized with a guild ID and a Discord client. 
 */
class MusicPanelManager {
    private static instances: Map<string, MusicPanelManager> = new Map();
    private client: discord.Client;
    private guildId: string;
    private message: discord.Message | null = null;
    private messageId: string | null = null;
    private channelId: string | null = null;

    /**
     * Private constructor - use getInstance instead
     * @param guildId Guild ID
     * @param client Discord client
     */
    private constructor(guildId: string, client: discord.Client) {
        this.guildId = guildId;
        this.client = client;
    }

    /**
     * Get an instance for a specific guild
     * @param guildId Guild ID
     * @param client Discord client
     * @returns MusicPanelManager instance
     */
    public static getInstance(
        guildId: string,
        client: discord.Client
    ): MusicPanelManager {
        if (!this.instances.has(guildId)) {
            this.instances.set(guildId, new MusicPanelManager(guildId, client));
        }
        return this.instances.get(guildId)!;
    }

    /**
     * Initialize the manager by fetching panel message and channel from database
     */
    public async init(): Promise<void> {
        try {
            const guildData = await music_guild.findOne({ guildId: this.guildId });
            if (!guildData || !guildData.songChannelId || !guildData.musicPannelId) {
                return;
            }

            this.channelId = guildData.songChannelId;
            this.messageId = guildData.musicPannelId;

            // Try to fetch the message
            const channel = await this.client.channels.fetch(this.channelId) as discord.TextChannel;
            if (!channel || !channel.isTextBased()) {
                return;
            }

            try {
                this.message = await channel.messages.fetch(this.messageId);
            } catch (error) {
                // Message not found, recreate it
                await this.recreatePanel(channel);
            }
        } catch (error) {
            this.client.logger.error(`[MUSIC_PANEL] Error initializing panel for guild ${this.guildId}: ${error}`);
        }
    }

    /**
     * Update the panel to show currently playing track
     * @param track Currently playing track
     * @param player Player instance
     */
    public async updateWithCurrentTrack(track: magmastream.Track, player: magmastream.Player): Promise<void> {
        if (!this.channelId) {
            await this.init();
        }

        if (!this.channelId || !this.messageId) {
            return;
        }

        try {
            const channel = await this.client.channels.fetch(this.channelId) as discord.TextChannel;
            if (!channel || !channel.isTextBased()) {
                return;
            }

            if (!this.message) {
                try {
                    this.message = await channel.messages.fetch(this.messageId);
                } catch (error) {
                    // Message not found, recreate it
                    await this.recreatePanel(channel);
                    if (!this.message) {
                        return;
                    }
                }
            }

            // Create the new embed with current track info
            const embed = await musicEmbed(this.client, track, player);

            // Update the embed
            await this.message.edit({ embeds: [embed] });
        } catch (error) {
            this.client.logger.error(`[MUSIC_PANEL] Error updating panel with track for guild ${this.guildId}: ${error}`);
        }
    }

    /**
     * Reset the panel to the default state
     */
    public async resetToDefault(): Promise<void> {
        if (!this.channelId) {
            await this.init();
        }

        if (!this.channelId || !this.messageId) {
            return;
        }

        try {
            const channel = await this.client.channels.fetch(this.channelId) as discord.TextChannel;
            if (!channel || !channel.isTextBased()) {
                return;
            }

            if (!this.message) {
                try {
                    this.message = await channel.messages.fetch(this.messageId);
                } catch (error) {
                    // Message not found, recreate it
                    await this.recreatePanel(channel);
                    return;
                }
            }

            // Create default panel
            const defaultMessage = await setupMusicChannelEmbed(channel, this.client);

            // Update the existing message instead of creating a new one
            if (defaultMessage && defaultMessage.embeds[0]) {
                await this.message.edit({ embeds: [defaultMessage.embeds[0]] });
            }
        } catch (error) {
            this.client.logger.error(`[MUSIC_PANEL] Error resetting panel for guild ${this.guildId}: ${error}`);
        }
    }

    /**
     * Recreate the panel if the original message is not found
     * @param channel Text channel to create the panel in
     */
    private async recreatePanel(channel: discord.TextChannel): Promise<void> {
        try {
            // Create new panel message
            const newPanel = await setupMusicChannelEmbed(channel, this.client);
            if (!newPanel) {
                return;
            }

            this.message = newPanel;
            this.messageId = newPanel.id;

            // Update the database with the new message ID
            await music_guild.updateOne(
                { guildId: this.guildId },
                { $set: { musicPannelId: newPanel.id } }
            );

            this.client.logger.info(`[MUSIC_PANEL] Recreated panel for guild ${this.guildId}`);
        } catch (error) {
            this.client.logger.error(`[MUSIC_PANEL] Error recreating panel for guild ${this.guildId}: ${error}`);
        }
    }
}

export default MusicPanelManager;