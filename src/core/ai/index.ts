import OpenAI from 'openai';

import { ConfigManager } from '../../utils/config';

const configManager = ConfigManager.getInstance();

export class AI {
	private readonly openai_client: OpenAI;

	constructor() {
		this.openai_client = new OpenAI({ baseURL: configManager.getOpenAiBaseUrl(), apiKey: configManager.getOpenAiApiKey() });
	}

	// AI Implementations will go here
	public example = async (): Promise<OpenAI.Responses.Response> => {
		return await this.openai_client.responses.create({
			model: 'gpt-4o',
			input: [{ role: 'user', content: 'Hello World' }],
		});
	};
}
