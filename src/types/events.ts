import discord from "discord.js";


export interface SlashCommand {
    data: discord.SlashCommandBuilder | discord.SlashCommandSubcommandsOnlyBuilder | discord.SlashCommandOptionsOnlyBuilder;
    modal?: (
        interaction: discord.ModalSubmitInteraction<discord.CacheType>
    ) => void;
    userPerms?: Array<discord.PermissionResolvable>;
    botPerms?: Array<discord.PermissionResolvable>;
    cooldown?: number;
    owner?: boolean;
    premium?: boolean;
    dj?: boolean;
    execute: (
        interaction: discord.ChatInputCommandInteraction,
        client: discord.Client
    ) => void;
    autocomplete?: (
        interaction: discord.AutocompleteInteraction,
        client: discord.Client
    ) => void;
}

export interface Command {
    name: string;
    description: string;
    userPerms?: Array<discord.PermissionResolvable>;
    botPerms?: Array<discord.PermissionResolvable>;
    cooldown?: number;
    owner?: boolean;
    premium?: boolean;
    dj?: boolean;
    execute: (
        client: discord.Client,
        message: discord.Message,
        args: Array<string>
    ) => void;
}

export interface BotEvent {
    name: string;
    once?: boolean | false;
    execute: (...args: any[]) => void | Promise<void>;
}

export interface LavalinkEvent {
    name: string;
    execute: (...args: any[]) => void | Promise<void>;
}

export interface IBotPresence {
    name: string;
    type: discord.ActivityType;
}