/// <reference types="node" />
import { Message } from 'discord.js';
import WebSocket from 'ws';
import { Collection } from '@discordjs/collection';
import { EventEmitter } from 'events';

/** Represents an equalizer band. */
interface Band {
    /** The index of the equalizer band. */
    band: number;
    /** The gain value of the equalizer band. */
    gain: number;
}

declare class Filters {
    distortion: distortionOptions | null;
    equalizer: Band[];
    karaoke: karaokeOptions | null;
    player: Player;
    rotation: rotationOptions | null;
    timescale: timescaleOptions | null;
    vibrato: vibratoOptions | null;
    volume: number;
    private filterStatus;
    constructor(player: Player);
    private updateFilters;
    private applyFilter;
    private setFilterStatus;
    /**
     * Sets the equalizer bands and updates the filters.
     * @param bands - The equalizer bands.
     */
    setEqualizer(bands?: Band[]): this;
    /** Applies the eight dimension audio effect. */
    eightD(): this;
    /** Applies the bass boost effect. */
    bassBoost(): this;
    /** Applies the nightcore effect. */
    nightcore(): this;
    /** Applies the slow motion audio effect. */
    slowmo(): this;
    /** Applies the soft audio effect. */
    soft(): this;
    /** Applies the television audio effect. */
    tv(): this;
    /** Applies the treble bass effect. */
    trebleBass(): this;
    /** Applies the vaporwave effect. */
    vaporwave(): this;
    /** Applies the distortion audio effect. */
    distort(): this;
    /** Applies the karaoke options specified by the filter. */
    setKaraoke(karaoke?: karaokeOptions): this;
    /** Applies the timescale options specified by the filter. */
    setTimescale(timescale?: timescaleOptions): this;
    /** Applies the vibrato options specified by the filter. */
    setVibrato(vibrato?: vibratoOptions): this;
    /** Applies the rotation options specified by the filter. */
    setRotation(rotation?: rotationOptions): this;
    /** Applies the distortion options specified by the filter. */
    setDistortion(distortion?: distortionOptions): this;
    /** Removes the audio effects and resets the filter status. */
    clearFilters(): Promise<this>;
    /** Returns the status of the specified filter . */
    getFilterStatus(filter: keyof availableFilters): boolean;
}
/** Options for adjusting the timescale of audio. */
interface timescaleOptions {
    /** The speed factor for the timescale. */
    speed?: number;
    /** The pitch factor for the timescale. */
    pitch?: number;
    /** The rate factor for the timescale. */
    rate?: number;
}
/** Options for applying vibrato effect to audio. */
interface vibratoOptions {
    /** The frequency of the vibrato effect. */
    frequency: number;
    /** * The depth of the vibrato effect.*/
    depth: number;
}
/** Options for applying rotation effect to audio. */
interface rotationOptions {
    /** The rotation speed in Hertz (Hz). */
    rotationHz: number;
}
/** Options for applying karaoke effect to audio. */
interface karaokeOptions {
    /** The level of karaoke effect. */
    level?: number;
    /** The mono level of karaoke effect. */
    monoLevel?: number;
    /** The filter band of karaoke effect. */
    filterBand?: number;
    /** The filter width of karaoke effect. */
    filterWidth?: number;
}
interface distortionOptions {
    sinOffset?: number;
    sinScale?: number;
    cosOffset?: number;
    cosScale?: number;
    tanOffset?: number;
    tanScale?: number;
    offset?: number;
    scale?: number;
}
interface availableFilters {
    bassboost: boolean;
    distort: boolean;
    eightD: boolean;
    karaoke: boolean;
    nightcore: boolean;
    slowmo: boolean;
    soft: boolean;
    trebleBass: boolean;
    tv: boolean;
    vaporwave: boolean;
}

/**
 * The player's queue, the `current` property is the currently playing track, think of the rest as the up-coming tracks.
 */
declare class Queue extends Array<Track | UnresolvedTrack> {
    /** The total duration of the queue. */
    get duration(): number;
    /** The total size of tracks in the queue including the current track. */
    get totalSize(): number;
    /** The size of tracks in the queue. */
    get size(): number;
    /** The current track */
    current: Track | UnresolvedTrack | null;
    /** The previous track */
    previous: Track | UnresolvedTrack | null;
    /**
     * Adds a track to the queue.
     * @param track
     * @param [offset=null]
     */
    add(track: (Track | UnresolvedTrack) | (Track | UnresolvedTrack)[], offset?: number): void;
    /**
     * Removes a track from the queue. Defaults to the first track, returning the removed track, EXCLUDING THE `current` TRACK.
     * @param [position=0]
     */
    remove(position?: number): (Track | UnresolvedTrack)[];
    /**
     * Removes an amount of tracks using a exclusive start and end exclusive index, returning the removed tracks, EXCLUDING THE `current` TRACK.
     * @param start
     * @param end
     */
    remove(start: number, end: number): (Track | UnresolvedTrack)[];
    /** Clears the queue. */
    clear(): void;
    /** Shuffles the queue. */
    shuffle(): void;
}

declare class Player {
    options: PlayerOptions;
    /** The Queue for the Player. */
    readonly queue: Queue;
    /** The filters applied to the audio. */
    filters: Filters;
    /** Whether the queue repeats the track. */
    trackRepeat: boolean;
    /** Whether the queue repeats the queue. */
    queueRepeat: boolean;
    /**Whether the queue repeats and shuffles after each song. */
    dynamicRepeat: boolean;
    /** The time the player is in the track. */
    position: number;
    /** Whether the player is playing. */
    playing: boolean;
    /** Whether the player is paused. */
    paused: boolean;
    /** The volume for the player */
    volume: number;
    /** The Node for the Player. */
    node: Node;
    /** The guild for the player. */
    guild: string;
    /** The voice channel for the player. */
    voiceChannel: string | null;
    /** The text channel for the player. */
    textChannel: string | null;
    /**The now playing message. */
    nowPlayingMessage?: NowPlayingMessage;
    /** The current state of the player. */
    state: State;
    /** The equalizer bands array. */
    bands: number[];
    /** The voice state object from Discord. */
    voiceState: VoiceState;
    /** The Manager. */
    manager: Manager;
    /** The autoplay state of the player. */
    isAutoplay: boolean;
    private static _manager;
    private readonly data;
    private dynamicLoopInterval;
    /**
     * Set custom data.
     * @param key
     * @param value
     */
    set(key: string, value: unknown): void;
    /**
     * Get custom data.
     * @param key
     */
    get<T>(key: string): T;
    /** @hidden */
    static init(manager: Manager): void;
    /**
     * Creates a new player, returns one if it already exists.
     * @param options
     */
    constructor(options: PlayerOptions);
    /**
     * Same as Manager#search() but a shortcut on the player itself.
     * @param query
     * @param requester
     */
    search(query: string | SearchQuery, requester?: unknown): Promise<SearchResult>;
    /** Connect to the voice channel. */
    connect(): this;
    /** Disconnect from the voice channel. */
    disconnect(): this;
    /** Destroys the player. */
    destroy(disconnect?: boolean): void;
    /**
     * Sets the player voice channel.
     * @param channel
     */
    setVoiceChannel(channel: string): this;
    /**
     * Sets the player text channel.
     * @param channel
     */
    setTextChannel(channel: string): this;
    /** Sets the now playing message. */
    setNowPlayingMessage(message: NowPlayingMessage): NowPlayingMessage;
    /** Plays the next track. */
    play(): Promise<void>;
    /**
     * Plays the specified track.
     * @param track
     */
    play(track: Track | UnresolvedTrack): Promise<void>;
    /**
     * Plays the next track with some options.
     * @param options
     */
    play(options: PlayOptions): Promise<void>;
    /**
     * Plays the specified track with some options.
     * @param track
     * @param options
     */
    play(track: Track | UnresolvedTrack, options: PlayOptions): Promise<void>;
    /**
     * Sets the autoplay-state of the player.
     * @param autoplayState
     * @param botUser
     */
    setAutoplay(autoplayState: boolean, botUser: object): this;
    /**
     * Sets the player volume.
     * @param volume
     */
    setVolume(volume: number): this;
    /**
     * Sets the track repeat.
     * @param repeat
     */
    setTrackRepeat(repeat: boolean): this;
    /**
     * Sets the queue repeat.
     * @param repeat
     */
    setQueueRepeat(repeat: boolean): this;
    /**
     * Sets the queue to repeat and shuffles the queue after each song.
     * @param repeat "true" or "false".
     * @param ms After how many milliseconds to trigger dynamic repeat.
     */
    setDynamicRepeat(repeat: boolean, ms: number): this;
    /** Restarts the current track to the start. */
    restart(): void;
    /** Stops the current track, optionally give an amount to skip to, e.g 5 would play the 5th song. */
    stop(amount?: number): this;
    /**
     * Pauses the current track.
     * @param pause
     */
    pause(pause: boolean): this;
    /** Go back to the previous song. */
    previous(): this;
    /**
     * Seeks to the position in the current track.
     * @param position
     */
    seek(position: number): this;
}
interface PlayerOptions {
    /** The guild the Player belongs to. */
    guild: string;
    /** The text channel the Player belongs to. */
    textChannel: string;
    /** The voice channel the Player belongs to. */
    voiceChannel?: string;
    /** The node the Player uses. */
    node?: string;
    /** The initial volume the Player will use. */
    volume?: number;
    /** If the player should mute itself. */
    selfMute?: boolean;
    /** If the player should deaf itself. */
    selfDeafen?: boolean;
}
/** If track partials are set some of these will be `undefined` as they were removed. */
interface Track {
    /** The base64 encoded track. */
    readonly track: string;
    /** The artwork url of the track. */
    readonly artworkUrl: string;
    /** The track source name. */
    readonly sourceName: string;
    /** The title of the track. */
    readonly title: string;
    /** The identifier of the track. */
    readonly identifier: string;
    /** The author of the track. */
    readonly author: string;
    /** The duration of the track. */
    readonly duration: number;
    /** If the track is seekable. */
    readonly isSeekable: boolean;
    /** If the track is a stream.. */
    readonly isStream: boolean;
    /** The uri of the track. */
    readonly uri: string;
    /** The thumbnail of the track or null if it's a unsupported source. */
    readonly thumbnail: string | null;
    /** The user that requested the track. */
    readonly requester: unknown | null;
    /** Displays the track thumbnail with optional size or null if it's a unsupported source. */
    displayThumbnail(size?: Sizes): string;
    /** Additional track info provided by plugins. */
    pluginInfo: TrackPluginInfo;
}
interface TrackPluginInfo {
    albumName?: string;
    albumUrl?: string;
    artistArtworkUrl?: string;
    artistUrl?: string;
    isPreview?: string;
    previewUrl?: string;
}
/** Unresolved tracks can't be played normally, they will resolve before playing into a Track. */
interface UnresolvedTrack extends Partial<Track> {
    /** The title to search against. */
    title: string;
    /** The author to search against. */
    author?: string;
    /** The duration to search within 1500 milliseconds of the results from YouTube. */
    duration?: number;
    /** Resolves into a Track. */
    resolve(): Promise<void>;
}
interface PlayOptions {
    /** The position to start the track. */
    readonly startTime?: number;
    /** The position to end the track. */
    readonly endTime?: number;
    /** Whether to not replace the track if a play payload is sent. */
    readonly noReplace?: boolean;
}
interface EqualizerBand {
    /** The band number being 0 to 14. */
    band: number;
    /** The gain amount being -0.25 to 1.00, 0.25 being double. */
    gain: number;
}
interface NowPlayingMessage {
    /** The ID of the channel. */
    channelId: string;
    /** The boolean indicating if the message has been deleted or not. */
    deleted?: boolean;
    /** The delete function. */
    delete: () => Promise<Message>;
}

/** Handles the requests sent to the Lavalink REST API. */
declare class Rest {
    /** The ID of the current session. */
    private sessionId;
    /** The password for the Node. */
    private readonly password;
    /** The URL of the Node. */
    private readonly url;
    constructor(node: Node);
    /**
     * Sets the session ID.
     * @returns {string} Returns the session ID.
     */
    setSessionId(sessionId: string): string;
    /** Retrieves all the players that are currently running on the node. */
    getAllPlayers(): Promise<unknown>;
    /** Sends a PATCH request to update player related data. */
    updatePlayer(options: playOptions): Promise<unknown>;
    /** Sends a DELETE request to the server to destroy the player. */
    destroyPlayer(guildId: string): Promise<unknown>;
    private request;
    get(endpoint: string): Promise<unknown>;
    patch(endpoint: string, body: unknown): Promise<unknown>;
    post(endpoint: string, body: unknown): Promise<unknown>;
    delete(endpoint: string): Promise<unknown>;
}
interface playOptions {
    guildId: string;
    data: {
        /** The base64 encoded track. */
        encodedTrack?: string;
        /** The track ID. */
        identifier?: string;
        /** The track time to start at. */
        startTime?: number;
        /** The track time to end at. */
        endTime?: number;
        /** The player volume level. */
        volume?: number;
        /** The player position in a track. */
        position?: number;
        /** Whether the player is paused. */
        paused?: boolean;
        /** The audio effects. */
        filters?: object;
        /** voice payload. */
        voice?: {
            token: string;
            sessionId: string;
            endpoint: string;
        };
        /** Whether to not replace the track if a play payload is sent. */
        noReplace?: boolean;
    };
}

declare class Node {
    options: NodeOptions;
    /** The socket for the node. */
    socket: WebSocket | null;
    /** The stats for the node. */
    stats: NodeStats;
    manager: Manager;
    /** The node's session ID. */
    sessionId: string | null;
    /** The REST instance. */
    readonly rest: Rest;
    private static _manager;
    private reconnectTimeout?;
    private reconnectAttempts;
    /** Returns if connected to the Node. */
    get connected(): boolean;
    /** Returns the address for this node. */
    get address(): string;
    /** @hidden */
    static init(manager: Manager): void;
    /**
     * Creates an instance of Node.
     * @param options
     */
    constructor(options: NodeOptions);
    /** Connects to the Node. */
    connect(): void;
    /** Destroys the Node and all players connected with it. */
    destroy(): void;
    private reconnect;
    protected open(): void;
    protected close(code: number, reason: string): void;
    protected error(error: Error): void;
    protected message(d: Buffer | string): void;
    protected handleEvent(payload: PlayerEvent & PlayerEvents): void;
    protected trackStart(player: Player, track: Track, payload: TrackStartEvent): void;
    protected trackEnd(player: Player, track: Track, payload: TrackEndEvent): Promise<void>;
    private handleAutoplay;
    private handleFailedTrack;
    private handleRepeatedTrack;
    private playNextTrack;
    protected queueEnd(player: Player, track: Track, payload: TrackEndEvent): Promise<void>;
    protected trackStuck(player: Player, track: Track, payload: TrackStuckEvent): void;
    protected trackError(player: Player, track: Track | UnresolvedTrack, payload: TrackExceptionEvent): void;
    protected socketClosed(player: Player, payload: WebSocketClosedEvent): void;
}
interface NodeOptions {
    /** The host for the node. */
    host: string;
    /** The port for the node. */
    port?: number;
    /** The password for the node. */
    password?: string;
    /** Whether the host uses SSL. */
    secure?: boolean;
    /** The identifier for the node. */
    identifier?: string;
    /** The retryAmount for the node. */
    retryAmount?: number;
    /** The retryDelay for the node. */
    retryDelay?: number;
    /** Whether to resume the previous session. */
    resumeStatus?: boolean;
    /** The time the manager will wait before trying to resume the previous session. */
    resumeTimeout?: number;
    /** The timeout used for api calls. */
    requestTimeout?: number;
    /** Priority of the node. */
    priority?: number;
}
interface NodeStats {
    /** The amount of players on the node. */
    players: number;
    /** The amount of playing players on the node. */
    playingPlayers: number;
    /** The uptime for the node. */
    uptime: number;
    /** The memory stats for the node. */
    memory: MemoryStats;
    /** The cpu stats for the node. */
    cpu: CPUStats;
    /** The frame stats for the node. */
    frameStats: FrameStats;
}
interface MemoryStats {
    /** The free memory of the allocated amount. */
    free: number;
    /** The used memory of the allocated amount. */
    used: number;
    /** The total allocated memory. */
    allocated: number;
    /** The reservable memory. */
    reservable: number;
}
interface CPUStats {
    /** The core amount the host machine has. */
    cores: number;
    /** The system load. */
    systemLoad: number;
    /** The lavalink load. */
    lavalinkLoad: number;
}
interface FrameStats {
    /** The amount of sent frames. */
    sent?: number;
    /** The amount of nulled frames. */
    nulled?: number;
    /** The amount of deficit frames. */
    deficit?: number;
}

declare abstract class TrackUtils {
    static trackPartial: string[] | null;
    private static manager;
    /** @hidden */
    static init(manager: Manager): void;
    static setTrackPartial(partial: string[]): void;
    /**
     * Checks if the provided argument is a valid Track or UnresolvedTrack, if provided an array then every element will be checked.
     * @param trackOrTracks
     */
    static validate(trackOrTracks: unknown): boolean;
    /**
     * Checks if the provided argument is a valid UnresolvedTrack.
     * @param track
     */
    static isUnresolvedTrack(track: unknown): boolean;
    /**
     * Checks if the provided argument is a valid Track.
     * @param track
     */
    static isTrack(track: unknown): boolean;
    /**
     * Builds a Track from the raw data from Lavalink and a optional requester.
     * @param data
     * @param requester
     */
    static build(data: TrackData, requester?: unknown): Track;
    /**
     * Builds a UnresolvedTrack to be resolved before being played  .
     * @param query
     * @param requester
     */
    static buildUnresolved(query: string | UnresolvedQuery, requester?: unknown): UnresolvedTrack;
    static getClosestTrack(unresolvedTrack: UnresolvedTrack): Promise<Track>;
}
/** Gets or extends structures to extend the built in, or already extended, classes to add more functionality. */
declare abstract class Structure {
    /**
     * Extends a class.
     * @param name
     * @param extender
     */
    static extend<K extends keyof Extendable, T extends Extendable[K]>(name: K, extender: (target: Extendable[K]) => T): T;
    /**
     * Get a structure from available structures by name.
     * @param name
     */
    static get<K extends keyof Extendable>(name: K): Extendable[K];
}
declare class Plugin {
    load(manager: Manager): void;
    unload(manager: Manager): void;
}
interface UnresolvedQuery {
    /** The title of the unresolved track. */
    title: string;
    /** The author of the unresolved track. If provided it will have a more precise search. */
    author?: string;
    /** The duration of the unresolved track. If provided it will have a more precise search. */
    duration?: number;
}
type Sizes = "0" | "1" | "2" | "3" | "default" | "mqdefault" | "hqdefault" | "maxresdefault";
type LoadType = "track" | "playlist" | "search" | "empty" | "error";
type State = "CONNECTED" | "CONNECTING" | "DISCONNECTED" | "DISCONNECTING" | "DESTROYING";
type PlayerEvents = TrackStartEvent | TrackEndEvent | TrackStuckEvent | TrackExceptionEvent | WebSocketClosedEvent;
type PlayerEventType = "TrackStartEvent" | "TrackEndEvent" | "TrackExceptionEvent" | "TrackStuckEvent" | "WebSocketClosedEvent";
type TrackEndReason = "finished" | "loadFailed" | "stopped" | "replaced" | "cleanup";
type Severity = "common" | "suspicious" | "fault";
interface TrackData {
    /** The track information. */
    encoded: string;
    /** The detailed information of the track. */
    info: TrackDataInfo;
    /** Additional track info provided by plugins. */
    pluginInfo: Record<string, string>;
}
interface TrackDataInfo {
    identifier: string;
    isSeekable: boolean;
    author: string;
    length: number;
    isStream: boolean;
    title: string;
    uri?: string;
    artworkUrl?: string;
    sourceName?: string;
}
interface Extendable {
    Player: typeof Player;
    Queue: typeof Queue;
    Node: typeof Node;
}
interface VoiceServer {
    token: string;
    guild_id: string;
    endpoint: string;
}
interface VoiceState {
    op: "voiceUpdate";
    guildId: string;
    event: VoiceServer;
    sessionId?: string;
}
interface VoiceState {
    guild_id: string;
    user_id: string;
    session_id: string;
    channel_id: string;
}
interface VoicePacket {
    t?: "VOICE_SERVER_UPDATE" | "VOICE_STATE_UPDATE";
    d: VoiceState | VoiceServer;
}
interface NodeMessage extends NodeStats {
    type: PlayerEventType;
    op: "stats" | "playerUpdate" | "event";
    guildId: string;
}
interface PlayerEvent {
    op: "event";
    type: PlayerEventType;
    guildId: string;
}
interface Exception {
    message: string;
    severity: Severity;
    cause: string;
}
interface TrackStartEvent extends PlayerEvent {
    type: "TrackStartEvent";
    track: TrackData;
}
interface TrackEndEvent extends PlayerEvent {
    type: "TrackEndEvent";
    track: TrackData;
    reason: TrackEndReason;
}
interface TrackExceptionEvent extends PlayerEvent {
    exception?: Exception;
    guildId: string;
    type: "TrackExceptionEvent";
}
interface TrackStuckEvent extends PlayerEvent {
    type: "TrackStuckEvent";
    thresholdMs: number;
}
interface WebSocketClosedEvent extends PlayerEvent {
    type: "WebSocketClosedEvent";
    code: number;
    reason: string;
    byRemote: boolean;
}
interface PlayerUpdate {
    op: "playerUpdate";
    /** The guild id of the player. */
    guildId: string;
    state: {
        /** Unix timestamp in milliseconds. */
        time: number;
        /** The position of the track in milliseconds. */
        position: number;
        /** Whether Lavalink is connected to the voice gateway. */
        connected: boolean;
        /** The ping of the node to the Discord voice server in milliseconds (-1 if not connected). */
        ping: number;
    };
}

/**
 * The main hub for interacting with Lavalink and using Magmastream,
 */
declare class Manager extends EventEmitter {
    /**
     * Emitted when a Node is created.
     * @event Manager#nodeCreate
     */
    on(event: "nodeCreate", listener: (node: Node) => void): this;
    /**
     * Emitted when a Node is destroyed.
     * @event Manager#nodeDestroy
     */
    on(event: "nodeDestroy", listener: (node: Node) => void): this;
    /**
     * Emitted when a Node connects.
     * @event Manager#nodeConnect
     */
    on(event: "nodeConnect", listener: (node: Node) => void): this;
    /**
     * Emitted when a Node reconnects.
     * @event Manager#nodeReconnect
     */
    on(event: "nodeReconnect", listener: (node: Node) => void): this;
    /**
     * Emitted when a Node disconnects.
     * @event Manager#nodeDisconnect
     */
    on(event: "nodeDisconnect", listener: (node: Node, reason: {
        code?: number;
        reason?: string;
    }) => void): this;
    /**
     * Emitted when a Node has an error.
     * @event Manager#nodeError
     */
    on(event: "nodeError", listener: (node: Node, error: Error) => void): this;
    /**
     * Emitted whenever any Lavalink event is received.
     * @event Manager#nodeRaw
     */
    on(event: "nodeRaw", listener: (payload: unknown) => void): this;
    /**
     * Emitted when a player is created.
     * @event Manager#playerCreate
     */
    on(event: "playerCreate", listener: (player: Player) => void): this;
    /**
     * Emitted when a player is destroyed.
     * @event Manager#playerDestroy
     */
    on(event: "playerDestroy", listener: (player: Player) => void): this;
    /**
     * Emitted when the state of the player has been changed.
     * https://github.com/Blackfort-Hosting/magmastream/issues/16
     * @event Manager#playerStateUpdate
     */
    on(event: "playerStateUpdate", listener: (oldPlayer: Player, newPlayer: Player) => void): this;
    /**
     * Emitted when a player is moved to a new voice channel.
     * @event Manager#playerMove
     */
    on(event: "playerMove", listener: (player: Player, initChannel: string, newChannel: string) => void): this;
    /**
     * Emitted when a player is disconnected from it's current voice channel.
     * @event Manager#playerDisconnect
     */
    on(event: "playerDisconnect", listener: (player: Player, oldChannel: string) => void): this;
    /**
     * Emitted when a player queue ends.
     * @event Manager#queueEnd
     */
    on(event: "queueEnd", listener: (player: Player, track: Track | UnresolvedTrack, payload: TrackEndEvent) => void): this;
    /**
     * Emitted when a voice connection is closed.
     * @event Manager#socketClosed
     */
    on(event: "socketClosed", listener: (player: Player, payload: WebSocketClosedEvent) => void): this;
    /**
     * Emitted when a track starts.
     * @event Manager#trackStart
     */
    on(event: "trackStart", listener: (player: Player, track: Track, payload: TrackStartEvent) => void): this;
    /**
     * Emitted when a track ends.
     * @event Manager#trackEnd
     */
    on(event: "trackEnd", listener: (player: Player, track: Track, payload: TrackEndEvent) => void): this;
    /**
     * Emitted when a track gets stuck during playback.
     * @event Manager#trackStuck
     */
    on(event: "trackStuck", listener: (player: Player, track: Track, payload: TrackStuckEvent) => void): this;
    /**
     * Emitted when a track has an error during playback.
     * @event Manager#trackError
     */
    on(event: "trackError", listener: (player: Player, track: Track | UnresolvedTrack, payload: TrackExceptionEvent) => void): this;
    static readonly DEFAULT_SOURCES: Record<SearchPlatform, string>;
    /** The map of players. */
    readonly players: Collection<string, Player>;
    /** The map of nodes. */
    readonly nodes: Collection<string, Node>;
    /** The options that were set. */
    readonly options: ManagerOptions;
    private initiated;
    /** Returns the nodes that has the least amount of players. */
    private get leastPlayersNode();
    /** Returns a node based on priority. */
    private get priorityNode();
    /** Returns the node to use. */
    get useableNodes(): Node;
    /**
     * Initiates the Manager class.
     * @param options
     */
    constructor(options: ManagerOptions);
    /**
     * Initiates the Manager.
     * @param clientId
     */
    init(clientId?: string): this;
    /**
     * Searches the enabled sources based off the URL or the `source` property.
     * @param query
     * @param requester
     * @returns The search result.
     */
    search(query: string | SearchQuery, requester?: unknown): Promise<SearchResult>;
    /**
     * Decodes the base64 encoded tracks and returns a TrackData array.
     * @param tracks
     */
    decodeTracks(tracks: string[]): Promise<TrackData[]>;
    /**
     * Decodes the base64 encoded track and returns a TrackData.
     * @param track
     */
    decodeTrack(track: string): Promise<TrackData>;
    /**
     * Creates a player or returns one if it already exists.
     * @param options
     */
    create(options: PlayerOptions): Player;
    /**
     * Returns a player or undefined if it does not exist.
     * @param guild
     */
    get(guild: string): Player | undefined;
    /**
     * Destroys a player if it exists.
     * @param guild
     */
    destroy(guild: string): void;
    /**
     * Creates a node or returns one if it already exists.
     * @param options
     */
    createNode(options: NodeOptions): Node;
    /**
     * Destroys a node if it exists.
     * @param identifier
     */
    destroyNode(identifier: string): void;
    /**
     * Sends voice data to the Lavalink server.
     * @param data
     */
    updateVoiceState(data: VoicePacket | VoiceServer | VoiceState): Promise<void>;
}
interface Payload {
    /** The OP code */
    op: number;
    d: {
        guild_id: string;
        channel_id: string | null;
        self_mute: boolean;
        self_deaf: boolean;
    };
}
interface ManagerOptions {
    /** Use priority mode over least amount of player? */
    usePriority?: boolean;
    /** The array of nodes to connect to. */
    nodes?: NodeOptions[];
    /** The client ID to use. */
    clientId?: string;
    /** Value to use for the `Client-Name` header. */
    clientName?: string;
    /** The shard count. */
    shards?: number;
    /** A array of plugins to use. */
    plugins?: Plugin[];
    /** Whether players should automatically play the next song. */
    autoPlay?: boolean;
    /** An array of track properties to keep. `track` will always be present. */
    trackPartial?: string[];
    /** The default search platform to use, can be "youtube", "youtube music", "soundcloud" or deezer. */
    defaultSearchPlatform?: SearchPlatform;
    /**
     * Function to send data to the websocket.
     * @param id
     * @param payload
     */
    send(id: string, payload: Payload): void;
}
type SearchPlatform = "deezer" | "soundcloud" | "youtube music" | "youtube";
interface SearchQuery {
    /** The source to search from. */
    source?: SearchPlatform | string;
    /** The query to search for. */
    query: string;
}
interface LavalinkResponse {
    loadType: LoadType;
    data: TrackData[] | PlaylistRawData;
}
interface SearchResult {
    /** The load type of the result. */
    loadType: LoadType;
    /** The array of tracks from the result. */
    tracks: Track[];
    /** The playlist info if the load type is 'playlist'. */
    playlist?: PlaylistData;
}
interface PlaylistRawData {
    info: {
        /** The playlist name. */
        name: string;
    };
    /** Addition info provided by plugins. */
    pluginInfo: object;
    /** The tracks of the playlist */
    tracks: TrackData[];
}
interface PlaylistData {
    /** The playlist name. */
    name: string;
    /** The length of the playlist. */
    duration: number;
    /** The songs of the playlist. */
    tracks: Track[];
}

export { type CPUStats, type EqualizerBand, type Exception, type Extendable, type FrameStats, type LavalinkResponse, type LoadType, Manager, type ManagerOptions, type MemoryStats, Node, type NodeMessage, type NodeOptions, type NodeStats, type NowPlayingMessage, type Payload, type PlayOptions, Player, type PlayerEvent, type PlayerEventType, type PlayerEvents, type PlayerOptions, type PlayerUpdate, type PlaylistData, type PlaylistRawData, Plugin, Queue, type SearchPlatform, type SearchQuery, type SearchResult, type Severity, type Sizes, type State, Structure, type Track, type TrackData, type TrackDataInfo, type TrackEndEvent, type TrackEndReason, type TrackExceptionEvent, type TrackPluginInfo, type TrackStartEvent, type TrackStuckEvent, TrackUtils, type UnresolvedQuery, type UnresolvedTrack, type VoicePacket, type VoiceServer, type VoiceState, type WebSocketClosedEvent };
