"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const openai_1 = __importDefault(require("openai"));
const config_1 = require("../../utils/config");
const configManager = config_1.ConfigManager.getInstance();
class LLM {
    constructor() {
        this.invoke = async (input, model = 'openai/gpt-oss-20b', options = {}) => {
            const response = this.client.responses.create({
                input: input,
                model: model,
                ...options,
            });
            return response;
        };
        this.generateSpeech = async (input, model = 'playai-tts', voice = 'Fritz-PlayAI', responseFormat = 'wav') => {
            const response = await this.client.audio.speech.create({
                model: model,
                voice: voice,
                input: input,
                response_format: responseFormat,
            });
            return Buffer.from(await response.arrayBuffer());
        };
        this.client = new openai_1.default({ apiKey: configManager.getOpenAiApiKey(), baseURL: configManager.getOpenAiBaseUrl() });
    }
}
exports.default = LLM;
