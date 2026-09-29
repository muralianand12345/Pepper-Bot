import { AutoplaySongRef } from './autoplay';

export type AIReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high';

export interface IAIConfig {
	enabled: boolean;
	model: string;
	reasoning_effort: AIReasoningEffort | null;
	temperature: number | null;
	max_output_tokens: number | null;
	timeout_ms: number;
	daily_limit: number;
	autoplay: {
		enabled: boolean;
		candidates: number;
		daily_limit_per_guild: number;
	};
}

export type IAIConfigInput = Partial<Omit<IAIConfig, 'autoplay'>> & { autoplay?: Partial<IAIConfig['autoplay']> };

export interface AIAutoplaySong extends AutoplaySongRef {
	tags: string[];
}

export interface AIAutoplayCandidate extends AIAutoplaySong {
	seedMatches: number;
}

export interface AIAutoplayRequest {
	guildId: string;
	count: number;
	previousMood: string | null;
	moodSongs: AIAutoplaySong[];
	listenerLikes: AIAutoplaySong[];
	skipped: AutoplaySongRef[];
	candidates: AIAutoplayCandidate[];
}

export interface AIAutoplayResult {
	picks: number[];
	mood: string;
}
