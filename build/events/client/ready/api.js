"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const discord_js_1 = __importDefault(require("discord.js"));
const package_json_1 = require("../../../../package.json");
const config_1 = require("../../../utils/config");
const spotify_1 = __importDefault(require("../../../core/api/music/accounts/spotify"));
const configManager = config_1.ConfigManager.getInstance();
class APIServer {
    constructor(client) {
        this.setupMiddleware = () => {
            this.app.use(express_1.default.json());
            this.app.use(express_1.default.urlencoded({ extended: true }));
        };
        this.setupRoutes = () => {
            const spotifyHandler = new spotify_1.default(this.client);
            this.app.use('/api/v1/accounts/spotify', spotifyHandler.getRouter());
            this.app.get('/', (req, res) => res.json({ message: 'Pepper API', version: package_json_1.version }));
        };
        this.start = () => {
            this.app.listen(this.port, () => this.client.logger.log(`API Server running on port ${this.port}`));
        };
        this.client = client;
        this.app = (0, express_1.default)();
        this.port = configManager.getApiPort() || 3000;
        this.setupMiddleware();
        this.setupRoutes();
    }
}
const event = {
    name: discord_js_1.default.Events.ClientReady,
    execute: async (client) => {
        const apiServer = new APIServer(client);
        apiServer.start();
    },
};
exports.default = event;
