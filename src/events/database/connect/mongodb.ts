import { connect, set } from 'mongoose';
import { Events } from 'discord.js';

import { BotEvent } from '../../../types';

const event: BotEvent = {
    name: Events.ClientReady,
    once: true,
    execute: (client) => {
        const MONGO_URI = process.env.MONGO_URI;
        if (!MONGO_URI) {
            throw new Error('MONGO_URI is not defined');
        }
        set('strictQuery', false);
        connect(MONGO_URI).then(() => {
            client.logger.success('Connected to MongoDB');
        }).catch((err) => {
            client.logger.error('Error connecting to MongoDB:');
            client.logger.error(err);
        });
    }
}

export default event;