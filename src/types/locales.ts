export type LocaleValue = string | number | boolean | LocaleData;

export interface LocaleData {
	[key: string]: LocaleValue;
}

export interface InterpolationData {
	[key: string]: string | number;
}
