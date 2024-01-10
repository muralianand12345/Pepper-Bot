"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rest = void 0;
const tslib_1 = require("tslib");
const axios_1 = tslib_1.__importDefault(require("axios"));
/** Handles the requests sent to the Lavalink REST API. */
class Rest {
    /** The ID of the current session. */
    sessionId;
    /** The password for the Node. */
    password;
    /** The URL of the Node. */
    url;
    constructor(node) {
        this.url = `http${node.options.secure ? "s" : ""}://${node.options.host}:${node.options.port}`;
        this.sessionId = node.sessionId;
        this.password = node.options.password;
    }
    /**
     * Sets the session ID.
     * @returns {string} Returns the session ID.
     */
    setSessionId(sessionId) {
        this.sessionId = sessionId;
        return this.sessionId;
    }
    /** Retrieves all the players that are currently running on the node. */
    async getAllPlayers() {
        return await this.get(`/v4/sessions/${this.sessionId}/players`);
    }
    /** Sends a PATCH request to update player related data. */
    async updatePlayer(options) {
        return await this.patch(`/v4/sessions/${this.sessionId}/players/${options.guildId}?noReplace=false`, options.data);
    }
    /** Sends a DELETE request to the server to destroy the player. */
    async destroyPlayer(guildId) {
        return await this.delete(`/v4/sessions/${this.sessionId}/players/${guildId}`);
    }
    /* Sends a GET request to the specified endpoint and returns the response data. */
    async request(method, endpoint, body) {
        const config = {
            method,
            url: this.url + endpoint,
            headers: {
                "Content-Type": "application/json",
                Authorization: this.password,
            },
            data: body,
        };
        try {
            const response = await (0, axios_1.default)(config);
            return response.data;
        }
        catch {
            return null;
        }
    }
    /* Sends a GET request to the specified endpoint and returns the response data. */
    async get(endpoint) {
        return await this.request("GET", endpoint);
    }
    /* Sends a PATCH request to the specified endpoint and returns the response data. */
    async patch(endpoint, body) {
        return await this.request("PATCH", endpoint, body);
    }
    /* Sends a POST request to the specified endpoint and returns the response data. */
    async post(endpoint, body) {
        return await this.request("POST", endpoint, body);
    }
    /* Sends a DELETE request to the specified endpoint and returns the response data. */
    async delete(endpoint) {
        return await this.request("DELETE", endpoint);
    }
}
exports.Rest = Rest;
