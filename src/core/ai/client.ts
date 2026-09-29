import { z } from 'zod';
import OpenAI from 'openai';
import discord from 'discord.js';

import { getAIConfig } from './config';
import { ConfigManager } from '../../utils/config';

const configManager = ConfigManager.getInstance();

export interface AIJsonRequest<T> {
	name: string;
	system: string;
	prompt: string;
	schema: z.ZodType<T>;
	jsonSchema: Record<string, unknown>;
}

export class AI {
	private static instance: AI | null = null;
	private readonly openai_client: OpenAI;

	private constructor(apiKey: string) {
		this.openai_client = new OpenAI({ apiKey, baseURL: configManager.getOpenAiBaseUrl(), maxRetries: 0 });
	}

	public static isAvailable = (client: discord.Client): boolean => getAIConfig(client).enabled && !!configManager.getOpenAiApiKey();

	public static getInstance = (): AI | null => {
		const apiKey = configManager.getOpenAiApiKey();
		if (!apiKey) return null;
		if (!AI.instance) AI.instance = new AI(apiKey);
		return AI.instance;
	};

	public completeJson = async <T>(client: discord.Client, request: AIJsonRequest<T>): Promise<T | null> => {
		const config = getAIConfig(client);
		const startedAt = Date.now();

		const completion = await this.openai_client.chat.completions.create(
			{
				model: config.model,
				messages: [
					{ role: 'system', content: request.system },
					{ role: 'user', content: request.prompt },
				],
				response_format: { type: 'json_schema', json_schema: { name: request.name, strict: true, schema: request.jsonSchema } },
				...(config.reasoning_effort ? { reasoning_effort: config.reasoning_effort } : {}),
				...(config.temperature !== null ? { temperature: config.temperature } : {}),
				...(config.max_output_tokens ? { max_completion_tokens: config.max_output_tokens } : {}),
			},
			{ timeout: config.timeout_ms },
		);

		const choice = completion.choices[0];
		client.logger.debug(`[AI] ${request.name} via ${completion.model}: ${completion.usage?.prompt_tokens ?? '?'} in, ${completion.usage?.completion_tokens ?? '?'} out, ${Date.now() - startedAt}ms`);
		if (choice?.finish_reason === 'length') throw new Error(`${request.name} was cut off; raise ai.max_output_tokens`);
		if (!choice?.message?.content || choice.message.refusal) return null;

		const parsed = request.schema.safeParse(JSON.parse(choice.message.content));
		return parsed.success ? parsed.data : null;
	};
}
