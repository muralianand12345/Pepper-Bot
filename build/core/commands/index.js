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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
exports.CommandManager = void 0;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const discord_js_1 = __importDefault(require("discord.js"));
const config_1 = require("../../utils/config");
__exportStar(require("./interaction"), exports);
const configManager = config_1.ConfigManager.getInstance();
class CommandManager {
    constructor(client) {
        this.commands = [];
        this.loadCommands = async (directory, fileFilter) => {
            const files = await promises_1.default.readdir(directory);
            const commandFiles = files.filter(fileFilter);
            return await Promise.all(commandFiles.map(async (file) => {
                const { default: command } = await Promise.resolve(`${path_1.default.join(directory, file)}`).then(s => __importStar(require(s)));
                return command;
            }));
        };
        this.register = async () => {
            const rest = new discord_js_1.default.REST({ version: '10' }).setToken(configManager.getToken() ?? '');
            await rest.put(discord_js_1.default.Routes.applicationCommands(this.client.user?.id ?? ''), { body: this.commands.map((command) => command.toJSON()) });
            this.client.logger.success('[COMMAND] Successfully registered application commands.');
        };
        this.load = async (directory) => {
            const loadCommands = (await this.loadCommands(directory, (file) => file.endsWith('.js') || file.endsWith('.ts')));
            loadCommands.forEach((command) => {
                this.client.commands.set(command.data.name, command);
                this.commands.push(command.data);
            });
            this.client.logger.info(`[COMMAND] Loaded ${this.client.commands.size} commands.`);
            await this.register();
        };
        this.client = client;
    }
}
exports.CommandManager = CommandManager;
