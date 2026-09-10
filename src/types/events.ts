import discord from 'discord.js';

export enum CommandCategory {
	UTILITY = 'utility',
	MUSIC = 'music',
	OTHER = 'other',
}

export interface CommandCategoryInfo {
	emoji: string;
	name: string;
}

export const COMMAND_CATEGORY_MAP: Record<CommandCategory, CommandCategoryInfo> = {
	[CommandCategory.MUSIC]: {
		emoji: '🎵',
		name: 'Music Commands',
	},
	[CommandCategory.UTILITY]: {
		emoji: '🔧',
		name: 'Utility Commands',
	},
	[CommandCategory.OTHER]: {
		emoji: '📦',
		name: 'Other Commands',
	},
};

export interface Command {
	data: discord.SlashCommandBuilder | discord.SlashCommandSubcommandsOnlyBuilder | discord.SlashCommandOptionsOnlyBuilder;
	modal?: (interaction: discord.ModalSubmitInteraction<discord.CacheType>) => Promise<discord.InteractionResponse<boolean> | void> | void;
	userPerms?: Array<discord.PermissionResolvable>;
	botPerms?: Array<discord.PermissionResolvable>;
	cooldown?: number;
	owner?: boolean;
	premium?: boolean;
	dj?: boolean;
	category?: CommandCategory;
	execute: (interaction: discord.ChatInputCommandInteraction, client: discord.Client) => Promise<discord.InteractionResponse<boolean> | discord.Message<boolean> | void> | discord.Message<boolean> | discord.InteractionResponse<boolean> | void;
	autocomplete?: (interaction: discord.AutocompleteInteraction, client: discord.Client) => Promise<void> | void;
}

export interface BotEvent {
	name: string;
	once?: boolean | false;
	execute: (...args: any[]) => void | Promise<void>;
}

export interface LavalinkEvent {
	name: string;
	execute: (...args: any[]) => void;
}

export interface BotPresence {
	name: string;
	type: discord.ActivityType;
}

export interface CommandApiChoice {
	name: string;
	value: string | number;
}

export interface CommandApiOption {
	name: string;
	description: string;
	type: number;
	typeName: string;
	required: boolean;
	autocomplete: boolean;
	choices: CommandApiChoice[];
}

export interface CommandApiSubcommand {
	name: string;
	description: string;
	group: string | null;
	options: CommandApiOption[];
}

export interface CommandApiEntry {
	name: string;
	description: string;
	category: CommandCategory;
	categoryName: string;
	categoryEmoji: string;
	cooldown: number;
	dj: boolean;
	premium: boolean;
	ownerOnly: boolean;
	userPermissions: string[];
	botPermissions: string[];
	options: CommandApiOption[];
	subcommands: CommandApiSubcommand[];
}

export interface CommandApiCategory {
	id: CommandCategory;
	name: string;
	emoji: string;
	count: number;
}

export interface CommandApiPayload {
	locale: string;
	total: number;
	categories: CommandApiCategory[];
	commands: CommandApiEntry[];
}
