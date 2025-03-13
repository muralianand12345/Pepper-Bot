import discord from 'discord.js';
import { CommandDto, SlashCommandOptionDto } from '../dto/commands-dto';
import { Command, SlashCommand } from '../../../../types';

/**
 * Service for handling command data retrieval
 */
class CommandService {
    private readonly client: discord.Client;

    /**
     * Create a new command service
     * @param client - Discord client
     */
    constructor(client: discord.Client) {
        this.client = client;
    }

    /**
     * Get all message-based commands
     * @returns Array of command DTOs
     */
    public getMessageCommands(): CommandDto[] {
        if (!this.client.commands) {
            return [];
        }

        return Array.from(this.client.commands.values()).map(cmd => this.mapMessageCommandToDto(cmd));
    }

    /**
     * Get all slash commands
     * @returns Array of command DTOs
     */
    public getSlashCommands(): CommandDto[] {
        if (!this.client.slashCommands) {
            return [];
        }

        return Array.from(this.client.slashCommands.values()).map(cmd => this.mapSlashCommandToDto(cmd));
    }

    /**
     * Get a specific command by name
     * @param name - Command name
     * @param type - Command type (slash or message)
     * @returns Command DTO or null if not found
     */
    public getCommandByName(name: string, type: 'SLASH' | 'MESSAGE'): CommandDto | null {
        if (type === 'MESSAGE') {
            const command = this.client.commands?.get(name);
            return command ? this.mapMessageCommandToDto(command) : null;
        } else {
            const command = this.client.slashCommands?.get(name);
            return command ? this.mapSlashCommandToDto(command) : null;
        }
    }

    /**
     * Map a message command to DTO
     * @param command - Message command object
     * @returns Command DTO
     * @private
     */
    private mapMessageCommandToDto(command: Command): CommandDto {
        return {
            name: command.name,
            description: command.description,
            type: 'MESSAGE',
            cooldown: command.cooldown,
            ownerOnly: command.owner || false,
            premiumOnly: command.premium || false,
            guildOnly: false, // Default value as it's not in the Command interface
            arguments: [] // Default value as Command interface doesn't specify arguments
        };
    }

    /**
     * Map a slash command to DTO
     * @param command - Slash command object
     * @returns Command DTO
     * @private
     */
    private mapSlashCommandToDto(command: SlashCommand): CommandDto {
        // Extract options from slash command data if available
        let options: SlashCommandOptionDto[] = [];

        if (command.data && 'options' in command.data) {
            options = this.extractOptionsFromSlashCommand(command.data);
        }

        return {
            name: command.data.name,
            description: command.data.description,
            type: 'SLASH',
            cooldown: command.cooldown,
            ownerOnly: command.owner || false,
            premiumOnly: command.premium || false,
            guildOnly: false, // Default value or determine from command data
            options
        };
    }

    /**
     * Extract options from a slash command
     * @param data - Slash command builder data
     * @returns Array of option DTOs
     * @private
     */
    private extractOptionsFromSlashCommand(data: any): SlashCommandOptionDto[] {
        if (!data.options) {
            return [];
        }

        try {
            // For slash commands built with SlashCommandBuilder
            if (typeof data.toJSON === 'function') {
                const jsonData = data.toJSON();
                return jsonData.options || [];
            }

            // For directly defined options
            return data.options.map((option: any) => {
                const optionDto: SlashCommandOptionDto = {
                    name: option.name,
                    description: option.description,
                    type: option.type,
                    required: option.required || false
                };

                if (option.choices) {
                    optionDto.choices = option.choices;
                }

                if (option.options) {
                    optionDto.options = this.extractOptionsFromSlashCommand({ options: option.options });
                }

                return optionDto;
            });
        } catch (error) {
            console.error('Error extracting slash command options:', error);
            return [];
        }
    }
}

export default CommandService;