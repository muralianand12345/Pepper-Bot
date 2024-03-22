"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Manager = void 0;
const tslib_1 = require("tslib");
/* eslint-disable no-async-promise-executor */
const Utils_1 = require("./Utils");
const collection_1 = require("@discordjs/collection");
const events_1 = require("events");
const managerCheck_1 = tslib_1.__importDefault(require("../utils/managerCheck"));
const REQUIRED_KEYS = ["event", "guild_id", "op", "sessionId"];
/**
 * The main hub for interacting with Lavalink and using Magmastream,
 */
class Manager extends events_1.EventEmitter {
    static DEFAULT_SOURCES = {
        "youtube music": "ytmsearch",
        youtube: "ytsearch",
        youtube: "ytsearch",
        soundcloud: "scsearch",
        deezer: "dzsearch",
        spotify: "spsearch",
        "ytmsearch": "ytmsearch",
        "ytm": "ytmsearch",
        "youtube": "ytsearch",
        "yt": "ytsearch",
        "ytsearch": "ytsearch",
        "soundcloud": "scsearch",
        "scsearch": "scsearch",
        "sc": "scsearch",
        "amsearch": "amsearch",
        "am": "amsearch",
        "spsearch": "spsearch",
        "sp": "spsearch",
        "sprec": "sprec",
        "spsuggestion": "sprec",
        "dz": "dzsearch",
        "deezer": "dzsearch",
        "ds": "dzsearch",
        "dzsearch": "dzsearch",
        "dzisrc": "dzisrc",
    };
    /** The map of players. */
    players = new collection_1.Collection();
    /** The map of nodes. */
    nodes = new collection_1.Collection();
    /** The options that were set. */
    options;
    initiated = false;
    /** Returns the nodes that has the least amount of players. */
    get leastPlayersNodes() {
        return this.nodes
            .filter((node) => node.connected)
            .sort((a, b) => a.stats.players - b.stats.players);
    }
    /**
     * Initiates the Manager class.
     * @param options
     */
    constructor(options) {
        super();
        (0, managerCheck_1.default)(options);
        Utils_1.Structure.get("Player").init(this);
        Utils_1.Structure.get("Node").init(this);
        Utils_1.TrackUtils.init(this);
        if (options.trackPartial) {
            Utils_1.TrackUtils.setTrackPartial(options.trackPartial);
            delete options.trackPartial;
        }
        this.options = {
            plugins: [],
            nodes: [
                {
                    identifier: "default",
                    host: "localhost",
                    resumeStatus: false,
                    resumeTimeout: 1000,
                },
            ],
            shards: 1,
            autoPlay: true,
            clientName: "Magmastream",
            defaultSearchPlatform: "youtube",
            ...options,
        };
        if (this.options.plugins) {
            for (const [index, plugin] of this.options.plugins.entries()) {
                if (!(plugin instanceof Utils_1.Plugin))
                    throw new RangeError(`Plugin at index ${index} does not extend Plugin.`);
                plugin.load(this);
            }
        }
        if (this.options.nodes) {
            for (const nodeOptions of this.options.nodes)
                new (Utils_1.Structure.get("Node"))(nodeOptions);
        }
    }
    /**
     * Initiates the Manager.
     * @param clientId
     */
    init(clientId) {
        if (this.initiated)
            return this;
        if (typeof clientId !== "undefined")
            this.options.clientId = clientId;
        if (typeof this.options.clientId !== "string")
            throw new Error('"clientId" set is not type of "string"');
        if (!this.options.clientId)
            throw new Error('"clientId" is not set. Pass it in Manager#init() or as a option in the constructor.');
        for (const node of this.nodes.values()) {
            try {
                node.connect();
            }
            catch (err) {
                this.emit("nodeError", node, err);
            }
        }
        this.initiated = true;
        return this;
    }
    /**
     * Searches the enabled sources based off the URL or the `source` property.
     * @param query
     * @param requester
     * @returns The search result.
     */
    async search(query, requester) {
        const node = this.leastPlayersNodes.first();
        if (!node) {
            throw new Error("No available nodes.");
        }
        const _query = typeof query === "string" ? { query } : query;
        const _source = Manager.DEFAULT_SOURCES[_query.source ?? this.options.defaultSearchPlatform] ?? _query.source;
        let search = _query.query;
        if (!/^https?:\/\//.test(search)) {
            search = `${_source}:${search}`;
        }
        try {
            const res = (await node.rest.get(`/v4/loadtracks?identifier=${encodeURIComponent(search)}`));
            if (!res) {
                throw new Error("Query not found.");
            }
            let searchData = [];
            let playlistData;
            switch (res.loadType) {
                case "search":
                    searchData = res.data;
                    break;
                case "track":
                    searchData = [res.data];
                    break;
                case "playlist":
                    playlistData = res.data;
                    break;
            }
            const tracks = searchData.map((track) => Utils_1.TrackUtils.build(track, requester));
            const playlist = res.loadType === "playlist"
                ? {
                    name: playlistData.info.name,
                    tracks: playlistData.tracks.map((track) => Utils_1.TrackUtils.build(track, requester)),
                    duration: playlistData.tracks.reduce((acc, cur) => acc + (cur.info.length || 0), 0),
                }
                : null;
            const result = {
                loadType: res.loadType,
                tracks,
                playlist,
            };
            return result;
        }
        catch (err) {
            throw new Error(err);
        }
    }
    /**
     * Decodes the base64 encoded tracks and returns a TrackData array.
     * @param tracks
     */
    decodeTracks(tracks) {
        return new Promise(async (resolve, reject) => {
            const node = this.nodes.first();
            if (!node)
                throw new Error("No available nodes.");
            const res = (await node.rest
                .post("/v4/decodetracks", JSON.stringify(tracks))
                .catch((err) => reject(err)));
            if (!res) {
                return reject(new Error("No data returned from query."));
            }
            return resolve(res);
        });
    }
    /**
     * Decodes the base64 encoded track and returns a TrackData.
     * @param track
     */
    async decodeTrack(track) {
        const res = await this.decodeTracks([track]);
        return res[0];
    }
    /**
     * Creates a player or returns one if it already exists.
     * @param options
     */
    create(options) {
        if (this.players.has(options.guild)) {
            return this.players.get(options.guild);
        }
        return new (Utils_1.Structure.get("Player"))(options);
    }
    /**
     * Returns a player or undefined if it does not exist.
     * @param guild
     */
    get(guild) {
        return this.players.get(guild);
    }
    /**
     * Destroys a player if it exists.
     * @param guild
     */
    destroy(guild) {
        this.players.delete(guild);
    }
    /**
     * Creates a node or returns one if it already exists.
     * @param options
     */
    createNode(options) {
        if (this.nodes.has(options.identifier || options.host)) {
            return this.nodes.get(options.identifier || options.host);
        }
        return new (Utils_1.Structure.get("Node"))(options);
    }
    /**
     * Destroys a node if it exists.
     * @param identifier
     */
    destroyNode(identifier) {
        const node = this.nodes.get(identifier);
        if (!node)
            return;
        node.destroy();
        this.nodes.delete(identifier);
    }
    /**
     * Sends voice data to the Lavalink server.
     * @param data
     */
    async updateVoiceState(data) {
        if ("t" in data &&
            !["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(data.t)) {
            return;
        }
        const update = "d" in data ? data.d : data;
        if (!update || (!("token" in update) && !("session_id" in update))) {
            return;
        }
        const player = this.players.get(update.guild_id);
        if (!player) {
            return;
        }
        if ("token" in update) {
            /* voice server update */
            player.voiceState.event = update;
        }
        else {
            /* voice state update */
            if (update.user_id !== this.options.clientId) {
                return;
            }
            if (update.channel_id) {
                if (player.voiceChannel !== update.channel_id) {
                    /* we moved voice channels. */
                    this.emit("playerMove", player, player.voiceChannel, update.channel_id);
                }
                player.voiceState.sessionId = update.session_id;
                player.voiceChannel = update.channel_id;
            }
            else {
                /* player got disconnected. */
                this.emit("playerDisconnect", player, player.voiceChannel);
                player.voiceChannel = null;
                player.voiceState = Object.assign({});
                player.pause(true);
            }
        }
        if (REQUIRED_KEYS.every((key) => key in player.voiceState)) {
            const { sessionId, event: { token, endpoint }, } = player.voiceState;
            await player.node.rest.updatePlayer({
                guildId: player.guild,
                data: { voice: { token, endpoint, sessionId } },
            });
        }
    }
}
exports.Manager = Manager;
