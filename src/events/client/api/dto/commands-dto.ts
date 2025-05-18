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
    options?: SlashCommandOptionDto[];
    example?: string;
}

export interface CommandsResponseDto {
    status: string;
    timestamp: string;
    count: number;
    data: {
        slash: CommandDto[];
        message: CommandDto[];
    };
}