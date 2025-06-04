export * from "./db";
export * from "./utils";
export * from "./auto_search";
export * from "./dj_role_service";
export * from "./autoplay_manager";
export * from "./music_validations";
export * from "./now_playing_manager";
export * from "./playlist_suggestion";

import discord from "discord.js";
import magmastream from "magmastream";
import { MusicResponseHandler } from "./utils";

export class Music {
    private client: discord.Client;
    private readonly default_config = {
        error_search_text: "No results found. Please try a different search.",
        default_search_text: "Please enter a song name or url",
        player_options: {
            volume: 50,
            selfDeafen: true,
        }
    }

    constructor(client: discord.Client) {
        this.client = client;
    }

    private async lavalinkNode(nodeChoice: string) {
        const node = this.client.manager.nodes.find(
            (n: magmastream.Node) => n.options.identifier === nodeChoice
        );

        if (!node) {
            return [
                new MusicResponseHandler(this.client).createErrorEmbed(
                    "Invalid Lavalink node"
                ),
            ]
        }

        if (!node.connected) {
            return [
                new MusicResponseHandler(this.client).createErrorEmbed(
                    "Lavalink node is not connected"
                ),
            ]
        }
    }

    public async play(interaction: discord.ChatInputCommandInteraction) {
        const query = interaction.options.getString("song") || this.default_config.default_search_text;
        const nodeChoice = interaction.options.getString("lavalink_node") || undefined;

        if (nodeChoice) {
            if (this.client.manager.get(interaction.guild?.id || "")) {
                return await interaction.reply({
                    embeds: [
                        new MusicResponseHandler(this.client).createErrorEmbed(
                            "Hmmm, you have an active music player in this server. Please stop the current player before switching Lavalink nodes."
                        ),
                    ],
                    flags: discord.MessageFlags.Ephemeral,
                });
            }

            const nodeResponse = await this.lavalinkNode(nodeChoice);
            if (nodeResponse) {
                return await interaction.reply({
                    embeds: nodeResponse,
                    flags: discord.MessageFlags.Ephemeral,
                });
            }
        }

        //other logic for playing music goes here
    }

    public async stop(interaction: discord.ChatInputCommandInteraction) {
    }

    public async skip(interaction: discord.ChatInputCommandInteraction) {
    }

    public async pause(interaction: discord.ChatInputCommandInteraction) {
    }

    public async resume(interaction: discord.ChatInputCommandInteraction) {
    }

    public async queue(interaction: discord.ChatInputCommandInteraction) {
    }

    public async filter(interaction: discord.ChatInputCommandInteraction) {
    }

    public async volume(interaction: discord.ChatInputCommandInteraction) {
    }
}