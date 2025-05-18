import discord from "discord.js";
import { connect, set } from "mongoose";
import { ConfigManager } from "../../../utils/config";
import { BotEvent } from "../../../types";

const configManager = ConfigManager.getInstance();

const event: BotEvent = {
    name: discord.Events.ClientReady,
    once: true,
    execute: (client: discord.Client): void => {
        const MONGO_URI = configManager.getMongoUri();
        if (!MONGO_URI) {
            throw new Error("[DATABASE] MONGO_URI is not defined");
        }
        set("strictQuery", false);
        connect(MONGO_URI)
            .then(() => {
                client.logger.success("[DATABASE] Connected to MongoDB");
            })
            .catch((err) => {
                client.logger.error("[DATABASE] Error connecting to MongoDB:");
                client.logger.error(err);
            });
    },
};

export default event;
