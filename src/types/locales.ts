export type LocaleValue = string | number | boolean | LocaleData;

export interface LocaleData {
	[key: string]: LocaleValue;
}

export interface InterpolationData {
	[key: string]: string | number;
}

export interface LanguageApiEntry {
	code: string;
	name: string;
	nativeName: string;
	discordLocale: string | null;
	default: boolean;
	completeness: number;
	totalKeys: number;
	missingKeys: number;
}

export interface LanguageApiPayload {
	default: string;
	total: number;
	languages: LanguageApiEntry[];
}
