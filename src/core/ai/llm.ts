import Groq from 'groq-sdk';

class LLM {
	private client: Groq;

	constructor() {
		this.client = new Groq({ apiKey: process.env.GROQ_API_KEY });
	}

    public generateSpeech = async (input: string, model: string = 'playai-tts', voice: string = 'Fritz-PlayAI', responseFormat: 'flac' | 'mp3' | 'mulaw' | 'ogg' | 'wav' = 'wav') => {
        const response = await this.client.audio.speech.create({
            model: model,
            voice: voice,
            input: input,
            response_format: responseFormat
        });

        const buffer = Buffer.from(await response.arrayBuffer());
    }
}
