const {
    connect,
    set
} = require('mongoose');
const {
    Events
} = require('discord.js');
require("dotenv").config();

module.exports = {
    name: Events.ClientReady,
    execute(client) {
        const dburl = process.env.DBURL;
        set('strictQuery', false);
        connect(dburl).then(client.logger.success('MongoDB Connected'));
    }
}