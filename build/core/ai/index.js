"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI = void 0;
const openai_1 = __importDefault(require("openai"));
const config_1 = require("../../utils/config");
const configManager = config_1.ConfigManager.getInstance();
class AI {
    constructor() {
        this.example = async () => {
            return await this.openai_client.responses.create({
                model: 'gpt-4o',
                input: [{ role: 'user', content: 'Hello World' }],
            });
        };
        this.openai_client = new openai_1.default({ baseURL: configManager.getOpenAiBaseUrl(), apiKey: configManager.getOpenAiApiKey() });
    }
}
exports.AI = AI;
