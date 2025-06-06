export interface PlayerDto {
    guildId: string;
    guildName: string;
    playing: boolean;
    paused: boolean;
    volume: number;
    currentTrack: TrackDto | null;
    queueSize: number;
}

export interface DetailedPlayerDto extends PlayerDto {
    trackRepeat: boolean;
    queueRepeat: boolean;
    queue: TrackDto[];
}

export interface TrackDto {
    title: string;
    author: string;
    duration: number;
    position?: number;
    uri: string;
    sourceName: string;
    artworkUrl?: string | null;
}

export interface MusicHistoryDto {
    title: string;
    author: string;
    sourceName: string;
    uri: string;
    played_number: number;
    timestamp: Date;
    artworkUrl?: string | null;
}

export interface MusicHistoryWithGuildDto extends MusicHistoryDto {
    guildId: string;
    guildName: string;
}