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
        this.getSpotifySongs = async (input, model_name = "gpt-5-mini") => {
            const system_instructions = `You are a music recommendation assistant. Your role is to recommend songs strictly based on the user’s query.
- If the user specifies a song, artist, or album, only provide recommendations directly related to that (e.g., similar songs, songs by the same artist, songs from the same album, or songs within the same style/genre).
- Do not provide unrelated recommendations. Stay on-topic and strictly follow the user’s reference.
- Do not include any citaions or urls in your response. The 'response' field should be formatted in discord's markdown format.`;
            const response = await this.openai_client.responses.parse({
                model: model_name,
                text: { format: {
                        "type": "json_schema",
                        "name": "spotify_recommendations",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "songs": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "song_name": { "type": "string", "description": "The name of the song" },
                                            "artist": { "type": "string", "description": "The artist of the song" },
                                            "album": { "type": "string", "description": "The album of the song" }
                                        },
                                        "required": ["song_name", "artist", "album"],
                                        "additionalProperties": false
                                    },
                                    "minItems": 1,
                                    "maxItems": 10,
                                    "description": "A list of songs that match the user's query"
                                },
                                "response": {
                                    "type": "string",
                                    "description": "A short response to the user about the recommendations provided without any citations or URLs"
                                }
                            },
                            "required": ["songs", "response"],
                            "additionalProperties": false
                        }
                    } },
                input: [
                    { role: "system", content: system_instructions },
                    { role: "user", content: input },
                ],
                instructions: system_instructions,
                tool_choice: "auto",
                tools: [{ "type": "web_search" }],
                reasoning: { effort: "low" },
            });
            if (!response.output_parsed)
                throw new Error("Failed to parse response from OpenAI");
            return response.output_parsed;
        };
        this.openai_client = new openai_1.default({ baseURL: configManager.getOpenAiBaseUrl(), apiKey: configManager.getOpenAiApiKey() });
    }
}
exports.AI = AI;
