import OpenAI from 'openai';

import { ConfigManager } from '../../utils/config';

const configManager = ConfigManager.getInstance();

class LLM {
	private client: OpenAI;

	constructor() {
		this.client = new OpenAI({ apiKey: configManager.getOpenAiApiKey(), baseURL: configManager.getOpenAiBaseUrl() });
	}

	public invoke = async (input: string | OpenAI.Responses.ResponseInput | undefined, model: string = 'openai/gpt-oss-20b', options: any = {}): Promise<OpenAI.Responses.Response> => {
		const response = this.client.responses.create({
			input: input,
			model: model,
			...options,
		});

		return response;
	};

	public generateSpeech = async (input: string, model: string = 'playai-tts', voice: string = 'Fritz-PlayAI', responseFormat: 'wav' | 'mp3' | 'opus' | 'aac' | 'flac' | 'pcm' | undefined = 'wav') => {
		const response = await this.client.audio.speech.create({
			model: model,
			voice: voice,
			input: input,
			response_format: responseFormat,
		});

		return Buffer.from(await response.arrayBuffer());
	};
}

export default LLM;
