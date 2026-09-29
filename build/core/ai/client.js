"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI = void 0;
const openai_1 = __importDefault(require("openai"));
const config_1 = require("./config");
const config_2 = require("../../utils/config");
const configManager = config_2.ConfigManager.getInstance();
class AI {
    constructor(apiKey) {
        this.completeJson = async (client, request) => {
            const config = (0, config_1.getAIConfig)(client);
            const startedAt = Date.now();
            const completion = await this.openai_client.chat.completions.create({
                model: config.model,
                messages: [
                    { role: 'system', content: request.system },
                    { role: 'user', content: request.prompt },
                ],
                response_format: { type: 'json_schema', json_schema: { name: request.name, strict: true, schema: request.jsonSchema } },
                ...(config.reasoning_effort ? { reasoning_effort: config.reasoning_effort } : {}),
                ...(config.temperature !== null ? { temperature: config.temperature } : {}),
                ...(config.max_output_tokens ? { max_completion_tokens: config.max_output_tokens } : {}),
            }, { timeout: config.timeout_ms });
            const choice = completion.choices[0];
            client.logger.debug(`[AI] ${request.name} via ${completion.model}: ${completion.usage?.prompt_tokens ?? '?'} in, ${completion.usage?.completion_tokens ?? '?'} out, ${Date.now() - startedAt}ms`);
            if (choice?.finish_reason === 'length')
                throw new Error(`${request.name} was cut off; raise ai.max_output_tokens`);
            if (!choice?.message?.content || choice.message.refusal)
                return null;
            const parsed = request.schema.safeParse(JSON.parse(choice.message.content));
            return parsed.success ? parsed.data : null;
        };
        this.openai_client = new openai_1.default({ apiKey, baseURL: configManager.getOpenAiBaseUrl(), maxRetries: 0 });
    }
}
exports.AI = AI;
AI.instance = null;
AI.isAvailable = (client) => (0, config_1.getAIConfig)(client).enabled && !!configManager.getOpenAiApiKey();
AI.getInstance = () => {
    const apiKey = configManager.getOpenAiApiKey();
    if (!apiKey)
        return null;
    if (!AI.instance)
        AI.instance = new AI(apiKey);
    return AI.instance;
};
