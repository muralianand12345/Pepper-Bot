"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pepper_1 = __importDefault(require("./pepper"));
const config_1 = require("./utils/config");
const configManager = config_1.ConfigManager.getInstance();
const loadHandlers = async (client, handlersPath) => {
    try {
        const handlerFiles = fs_1.default.readdirSync(handlersPath).filter((file) => file.endsWith('.js') || file.endsWith('.ts'));
        for (const file of handlerFiles) {
            try {
                const filePath = path_1.default.join(handlersPath, file);
                const handler = require(filePath).default;
                if (!handler?.name || !handler?.execute) {
                    client.logger.warn(`[MAIN] Invalid handler file structure: ${file}`);
                    continue;
                }
                client.on(handler.name, (...args) => handler.execute(...args, client));
                client.logger.info(`[MAIN] Loaded handler: ${handler.name}`);
            }
            catch (error) {
                client.logger.error(`[MAIN] Failed to load handler ${file}: ${error}`);
            }
        }
    }
    catch (error) {
        client.logger.error(`[MAIN] Failed to read handlers directory: ${error}`);
        throw error;
    }
};
const loadEvents = async (client, basePath, currentPath = basePath, ignoreFolders = ['entities', 'repo']) => {
    try {
        const items = fs_1.default.readdirSync(currentPath, { withFileTypes: true });
        for (const item of items) {
            const itemPath = path_1.default.join(currentPath, item.name);
            const relativePath = path_1.default.relative(basePath, itemPath);
            if (item.isDirectory()) {
                if (ignoreFolders.some((folder) => item.name.toLowerCase().endsWith(folder.toLowerCase()))) {
                    client.logger.debug(`[MAIN] Skipping ignored folder: ${item.name}`);
                    continue;
                }
                await loadEvents(client, basePath, itemPath, ignoreFolders);
            }
            else if (item.isFile() && (item.name.endsWith('.js') || item.name.endsWith('.ts')) && !item.name.endsWith('.d.ts')) {
                try {
                    const event = require(itemPath).default;
                    if (!event?.name || !event?.execute) {
                        client.logger.debug(`[MAIN] Skipping non-event file: ${relativePath}`);
                        continue;
                    }
                    if (event.once) {
                        client.once(event.name, (...args) => event.execute(...args, client));
                    }
                    else {
                        client.on(event.name, (...args) => event.execute(...args, client));
                    }
                    client.logger.debug(`[MAIN] Loaded event: ${event.name} from ${relativePath}`);
                }
                catch (error) {
                    client.logger.error(`[MAIN] Failed to load event ${itemPath}: ${error}`);
                }
            }
        }
    }
    catch (error) {
        client.logger.error(`[MAIN] Error loading from directory ${currentPath}: ${error}`);
    }
};
const setupErrorHandlers = (client) => {
    process.on('unhandledRejection', (error) => {
        client.logger.error(`[UNHANDLED-REJECTION] ${error.name}: ${error.message}`);
        client.logger.error(`Stack trace: ${error.stack}`);
    });
    process.on('uncaughtException', (error, origin) => {
        client.logger.error(`[UNCAUGHT-EXCEPTION] ${error.name}: ${error.message}`);
        client.logger.error(`[UNCAUGHT-EXCEPTION] Origin: ${origin}`);
        client.logger.error(`[UNCAUGHT-EXCEPTION] Stack trace: ${error.stack}`);
    });
};
const initializeBot = async (client) => {
    const handlersPath = path_1.default.join(__dirname, 'handlers');
    const eventsPath = path_1.default.join(__dirname, 'events');
    try {
        await loadHandlers(client, handlersPath);
        await loadEvents(client, eventsPath);
        setupErrorHandlers(client);
        await client.login(configManager.getToken());
        client.logger.success(`[MAIN] [${client.user?.username} #${client.user?.discriminator}] has connected successfully`);
        client.logger.info(`Code by MRBotZ ❤️`);
    }
    catch (error) {
        client.logger.error(`[MAIN] Failed to initialize bot: ${error}`);
        process.exit(1);
    }
};
initializeBot(pepper_1.default).catch((error) => {
    pepper_1.default.logger.error(`[MAIN] Fatal error during initialization: ${error}`);
    process.exit(1);
});
