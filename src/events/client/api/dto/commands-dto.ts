/**
 * Data Transfer Objects for Command API
 */

/**
 * Interface representing the command argument
 */
export interface CommandArgumentDto {
    name: string;
    description: string;
    type: string;
    required: boolean;
    choices?: Array<{
        name: string;
        value: string | number;
    }>;
}

/**
 * Interface representing a slash command option (subcommand or argument)
 */
export interface SlashCommandOptionDto {
    name: string;
    description: string;
    type: number;
    required?: boolean;
    options?: SlashCommandOptionDto[];
    choices?: Array<{
        name: string;
        value: string | number;
    }>;
}

/**
 * Interface representing a Discord command
 */
export interface CommandDto {
    name: string;
    description: string;
    type: 'SLASH' | 'MESSAGE';
    category?: string;
    cooldown?: number;
    guildOnly?: boolean;
    ownerOnly?: boolean;
    premiumOnly?: boolean;
    arguments?: CommandArgumentDto[];
    options?: SlashCommandOptionDto[]; // For slash commands
    example?: string;
}

/**
 * Response format for commands list
 */
export interface CommandsResponseDto {
    status: string;
    timestamp: string;
    count: number;
    data: {
        slash: CommandDto[];
        message: CommandDto[];
    };
}