export interface IAutoplayConfig {
	batch_size: number;
	favorites_per_batch: number;
	refill_below: number;
	history_days: number;
	early_skip_seconds: number;
	seeds: {
		session: number;
		listeners: number;
		server: number;
	};
}

export interface AutoplaySongRef {
	title: string;
	artist: string;
}

export interface AutoplaySessionState {
	enabled: boolean;
	enabledBy: string | null;
	startedAt: number;
	anchors: AutoplaySongRef[];
	skipped: AutoplaySongRef[];
	picked: AutoplaySongRef[];
	stalls: number;
	mood: string | null;
}

export type AutoplaySeedOrigin = 'session' | 'listener' | 'server';

export interface AutoplaySeed extends AutoplaySongRef {
	origin: AutoplaySeedOrigin;
	weight: number;
}

export interface AutoplayFavorite extends AutoplaySongRef {
	uri: string;
	plays: number;
}

export interface AutoplayCandidate extends AutoplaySongRef {
	deezerId: number | null;
	duration: number | null;
	score: number;
	seedHits: Set<string>;
	tags: string[];
}
