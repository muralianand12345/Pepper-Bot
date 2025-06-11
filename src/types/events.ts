import discord from 'discord.js';


export interface Command {
    data: discord.SlashCommandBuilder | discord.SlashCommandSubcommandsOnlyBuilder | discord.SlashCommandOptionsOnlyBuilder;
    modal?: (
        interaction: discord.ModalSubmitInteraction<discord.CacheType>
    ) => Promise<void> | void;
    userPerms?: Array<discord.PermissionResolvable>;
    botPerms?: Array<discord.PermissionResolvable>;
    cooldown?: number;
    owner?: boolean;
    premium?: boolean;
    execute: (interaction: discord.ChatInputCommandInteraction, client: discord.Client) => Promise<discord.InteractionResponse<boolean> | discord.Message<boolean> | void> | discord.Message<boolean> | discord.InteractionResponse<boolean> | void;
    autocomplete?: (
        interaction: discord.AutocompleteInteraction,
        client: discord.Client
    ) => Promise<void> | void;
};

export interface BotEvent {
    name: string;
    once?: boolean | false;
    execute: (...args: any[]) => void | Promise<void>;
};

export interface LavalinkEvent {
    name: string;
    execute: (...args: any[]) => void;
};

export interface BotPresence {
    name: string;
    type: discord.ActivityType;
};