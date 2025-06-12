"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const discord_js_1 = __importDefault(require("discord.js"));
const config_1 = require("../utils/config");
const configManager = config_1.ConfigManager.getInstance();
const loadCommands = async (directory, fileFilter) => {
    const files = await promises_1.default.readdir(directory);
    const commandFiles = files.filter(fileFilter);
    return await Promise.all(commandFiles.map(async (file) => {
        const { default: command } = await Promise.resolve(`${path_1.default.join(directory, file)}`).then(s => __importStar(require(s)));
        return command;
    }));
};
const event = {
    name: discord_js_1.default.Events.ClientReady,
    execute: async (client) => {
        const clientId = client.user?.id;
        if (!clientId)
            return client.logger.error("[COMMAND] Client Id is undefined");
        const commands = new discord_js_1.default.Collection();
        const slashCommands = [];
        const slashCommandsDir = path_1.default.join(__dirname, "../commands");
        const loadedSlashCommands = (await loadCommands(slashCommandsDir, (file) => file.endsWith(".js") || file.endsWith(".ts")));
        loadedSlashCommands.forEach((command) => {
            client.commands.set(command.data.name, command);
            slashCommands.push(command.data);
            commands.set(command.data.name, command);
        });
        client.logger.info(`[COMMAND] Loaded ${client.commands.size} commands.`);
        try {
            const rest = new discord_js_1.default.REST({ version: "10" }).setToken(configManager.getToken() ?? "");
            await rest.put(discord_js_1.default.Routes.applicationCommands(clientId), { body: slashCommands.map((command) => command.toJSON()) });
            client.logger.success("[COMMAND] Successfully registered application commands.");
        }
        catch (error) {
            client.logger.error(`[COMMAND] Failed to register application commands: ${error}`);
        }
    }
};
exports.default = event;
