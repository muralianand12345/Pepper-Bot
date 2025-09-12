const mongoose = require('mongoose');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
require('dotenv').config();

const unwrapDefault = (mod) => {
    return mod && (mod.default || mod);
}

const MusicUser = unwrapDefault(require('../build/events/database/schema/music_user'));
const MusicGuild = unwrapDefault(require('../build/events/database/schema/music_guild'));

const argv = yargs(hideBin(process.argv))
    .option('uri', { type: 'string', describe: 'MongoDB connection string (overrides env MONGO_URI)' })
    .option('dry-run', { type: 'boolean', describe: 'Only report, do not write changes', default: true })
    .help()
    .parse();

const log = (level, msg) => {
    const prefixMap = { info: '[INFO]', warn: '[WARN]', error: '[ERROR]', success: '[OK]' };
    const prefix = prefixMap[level] || '[INFO]';
    console.log(`${new Date().toISOString()} ${prefix} ${msg}`);
}

const connect = async () => {
    const uri = argv.uri || process.env.MONGO_URI;
    if (!uri) throw new Error('Missing Mongo URI. Provide --uri or set MONGO_URI in environment.');
    await mongoose.connect(uri);
    return mongoose.connection;
}

const normalizeRequester = (requester) => {
    if (!requester || typeof requester !== 'object') return null;
    const id = requester.id ?? requester.userId ?? requester._id;
    if (!id || (typeof id !== 'string' && typeof id !== 'number')) return null;
    return {
        id: String(id),
        username: typeof requester.username === 'string' ? requester.username : 'Unknown',
        discriminator: typeof requester.discriminator === 'string' ? requester.discriminator : '0000',
        avatar: typeof requester.avatar === 'string' ? requester.avatar : undefined,
    };
}

const repairMusicUsers = async (dryRun) => {
    const cursor = MusicUser.find().cursor();
    let scanned = 0;
    let fixed = 0;
    for await (const doc of cursor) {
        scanned++;
        const updates = {};

        if (doc.userId && typeof doc.userId !== 'string') updates.userId = String(doc.userId?.id || doc.userId?._id || doc.userId);
        if (Array.isArray(doc.songs)) {
            const newSongs = doc.songs.map((s) => {
                const ns = { ...s };
                if (s && typeof s === 'object') {
                    if (s.requester) ns.requester = normalizeRequester(s.requester);
                    if (typeof s.played_number !== 'number') ns.played_number = Number(s.played_number) || 1;
                    if (s.timestamp && !(s.timestamp instanceof Date)) ns.timestamp = new Date(s.timestamp);
                }
                return ns;
            });
            updates.songs = newSongs;
        }
        if (Object.keys(updates).length > 0) {
            fixed++;
            if (!dryRun) await MusicUser.updateOne({ _id: doc._id }, { $set: updates });
        }
    }
    log('success', `music-users scanned=${scanned}, fixed=${fixed}${dryRun ? ' (dry-run)' : ''}`);
}

const repairMusicGuilds = async (dryRun) => {
    const cursor = MusicGuild.find().cursor();
    let scanned = 0;
    let fixed = 0;
    for await (const doc of cursor) {
        scanned++;
        const updates = {};

        if (doc.guildId && typeof doc.guildId !== 'string') updates.guildId = String(doc.guildId?.id || doc.guildId?._id || doc.guildId);
        if (doc.dj && typeof doc.dj !== 'string') updates.dj = null;
        if (Array.isArray(doc.songs)) {
            const newSongs = doc.songs.map((s) => {
                const ns = { ...s };
                if (s && typeof s === 'object') {
                    if (s.requester) ns.requester = normalizeRequester(s.requester);
                    if (typeof s.played_number !== 'number') ns.played_number = Number(s.played_number) || 1;
                    if (s.timestamp && !(s.timestamp instanceof Date)) ns.timestamp = new Date(s.timestamp);
                }
                return ns;
            });
            updates.songs = newSongs;
        }
        if (Object.keys(updates).length > 0) {
            fixed++;
            if (!dryRun) await MusicGuild.updateOne({ _id: doc._id }, { $set: updates });
        }
    }
    log('success', `music-guilds scanned=${scanned}, fixed=${fixed}${dryRun ? ' (dry-run)' : ''}`);
}

const main = async () => {
    const dryRun = Boolean(argv['dry-run']);
    let conn = null;
    try {
        conn = await connect();
        await repairMusicUsers(dryRun);
        await repairMusicGuilds(dryRun);
        log('success', 'Repair completed');
    } catch (err) {
        log('error', `Repair failed: ${err}`);
        process.exitCode = 1;
    } finally {
        if (conn) await conn.close();
    }
}

main();
