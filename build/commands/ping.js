"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const discord_js_1 = __importDefault(require("discord.js"));
const types_1 = require("../types");
const locales_1 = require("../core/locales");
const v2_1 = require("../utils/v2");
const localeDetector = new locales_1.LocaleDetector();
const localizationManager = locales_1.LocalizationManager.getInstance();
const pingCommand = {
    cooldown: 3600,
    category: types_1.CommandCategory.UTILITY,
    data: new discord_js_1.default.SlashCommandBuilder().setName('ping').setDescription("Check the bot's latency and connection status").setNameLocalizations(localizationManager.getCommandLocalizations('commands.ping.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.ping.description')),
    execute: async (interaction, client) => {
        const t = await localeDetector.getTranslator(interaction);
        const isOwner = client.config.bot.owners.includes(interaction.user.id);
        const startTime = Date.now();
        await interaction.deferReply();
        const endTime = Date.now();
        const apiLatency = endTime - startTime;
        const wsLatency = client.ws.ping;
        const getDatabaseLatency = async () => {
            try {
                const dbStart = Date.now();
                if (!mongoose_1.default.connection.db)
                    return -1;
                await mongoose_1.default.connection.db.admin().ping();
                return Date.now() - dbStart;
            }
            catch (error) {
                return -1;
            }
        };
        const dbLatency = await getDatabaseLatency();
        const getLatencyEmoji = (latency) => {
            if (latency === -1)
                return '❌';
            if (latency < 150)
                return '🟢';
            if (latency < 350)
                return '🟡';
            return '🔴';
        };
        const getNodeStatus = () => {
            const connectedNodes = client.manager.nodes.filter((node) => node.connected);
            const totalNodes = client.manager.nodes.size;
            if (connectedNodes.size === 0)
                return '❌ No nodes connected';
            if (connectedNodes.size === totalNodes)
                return '🟢 All nodes connected';
            return `🟡 ${connectedNodes.size}/${totalNodes} nodes connected`;
        };
        const settle = async (promise) => promise.then((value) => (Array.isArray(value) ? value : []), () => []);
        const getShardStats = async () => {
            if (!client.shard)
                return null;
            const [guilds, members, players, ping] = await Promise.all([
                settle(client.shard.fetchClientValues('guilds.cache.size')),
                settle(client.shard.broadcastEval((c) => c.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0))),
                settle(client.shard.broadcastEval((c) => c.manager?.players.size ?? 0)),
                settle(client.shard.fetchClientValues('ws.ping')),
            ]);
            return { current: client.shard.ids[0] ?? 0, total: client.shard.count, guilds, members, players, ping };
        };
        const formatShardStats = (stats) => {
            const shardCount = Math.max(stats.guilds.length, stats.members.length, stats.ping.length);
            const totalGuilds = stats.guilds.reduce((a, b) => a + (b ?? 0), 0);
            const totalMembers = stats.members.reduce((a, b) => a + (b ?? 0), 0);
            const totalPlayers = stats.players.reduce((a, b) => a + (b ?? 0), 0);
            const reportedPings = stats.ping.filter((p) => typeof p === 'number' && p >= 0);
            const avgPing = reportedPings.length ? Math.round(reportedPings.reduce((a, b) => a + b, 0) / reportedPings.length) : -1;
            const lines = [
                `**Current Shard:** #${stats.current}`,
                `**Total Shards:** ${stats.total}${shardCount && shardCount !== stats.total ? ` (${shardCount} responding)` : ''}`,
                `**Total Guilds:** ${totalGuilds.toLocaleString()}`,
                `**Total Members:** ${totalMembers.toLocaleString()}`,
                `**Total Players:** ${totalPlayers.toLocaleString()}`,
                `**Average Ping:** ${avgPing === -1 ? 'N/A' : `${avgPing}ms`}`,
                '',
                '**Per Shard:**',
                ...Array.from({ length: shardCount }, (_, i) => {
                    const shardPing = stats.ping[i];
                    if (shardPing === undefined || stats.guilds[i] === undefined)
                        return `⚫ Shard #${i}: unreachable`;
                    const emoji = shardPing < 150 ? '🟢' : shardPing < 350 ? '🟡' : '🔴';
                    return `${emoji} Shard #${i}: ${(stats.guilds[i] ?? 0).toLocaleString()} guilds, ${(stats.members[i] ?? 0).toLocaleString()} members, ${(stats.players[i] ?? 0).toLocaleString()} players, ${shardPing}ms`;
                }),
            ];
            return lines.join('\n');
        };
        const getPlayerInfo = async () => {
            if (!isOwner)
                return '';
            const players = Array.from(client.manager.players.values());
            const shardLabel = client.shard ? ` (shard #${client.shard.ids[0] ?? 0})` : '';
            if (players.length === 0)
                return `No active players${shardLabel}`;
            const playerInfos = await Promise.all(players.map(async (player) => {
                const guild = client.guilds.cache.get(player.guildId);
                const voiceChannel = client.channels.cache.get(player.voiceChannelId || '');
                const currentTrack = await player.queue.getCurrent();
                const guildName = guild?.name || 'Unknown Guild';
                const channelName = voiceChannel && 'name' in voiceChannel ? voiceChannel.name : 'Unknown Channel';
                let userCount = 0;
                if (voiceChannel && voiceChannel.isVoiceBased())
                    userCount = voiceChannel.members.filter((m) => !m.user.bot).size;
                const trackInfo = currentTrack ? `${currentTrack.title} - ${currentTrack.author}`.slice(0, 50) : 'No track playing';
                const status = player.playing ? '▶️' : player.paused ? '⏸️' : '⏹️';
                const queueSize = await player.queue.size();
                return `${status} **${guildName}**\n` + `└ Channel: ${channelName}\n` + `└ Users: ${userCount} ${userCount === 1 ? 'user' : 'users'}\n` + `└ Track: ${trackInfo}\n` + `└ Queue: ${queueSize + 1} songs\n` + `└ Node: ${player.node.options.identifier}`;
            }));
            return `**Players on this shard${shardLabel ? ` #${client.shard?.ids[0] ?? 0}` : ''}:**\n\n` + playerInfos.join('\n\n');
        };
        const container = (0, v2_1.panel)(0x5865f2, {
            title: t('responses.ping.title'),
            body: [
                t('responses.ping.description'),
                (0, v2_1.fields)([
                    [t('responses.ping.api_latency'), `${getLatencyEmoji(apiLatency)} ${apiLatency}ms`],
                    [t('responses.ping.websocket_latency'), `${getLatencyEmoji(wsLatency)} ${wsLatency}ms`],
                    [t('responses.ping.database_latency'), dbLatency === -1 ? '❌ Connection failed' : `${getLatencyEmoji(dbLatency)} ${dbLatency}ms`],
                    [t('responses.ping.music_nodes'), getNodeStatus()],
                    [t('responses.ping.uptime'), `<t:${Math.floor((Date.now() - (client.uptime || 0)) / 1000)}:R>`],
                    [t('responses.ping.memory_usage'), `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`],
                ]),
            ].join('\n\n'),
            footer: t('responses.ping.footer'),
            timestamp: true,
        });
        if (isOwner) {
            const playerInfo = await getPlayerInfo();
            const shardStats = await getShardStats();
            const ownerSections = [`**${t('responses.ping.active_players')}**\n${playerInfo.length > 1024 ? playerInfo.substring(0, 1021) + '...' : playerInfo || 'No active players'}`];
            if (shardStats)
                ownerSections.push(`**${t('responses.ping.shard_stats')}**\n${formatShardStats(shardStats)}`);
            container.addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(true).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
            container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(ownerSections.join('\n\n')));
        }
        await interaction.editReply((0, v2_1.v2)(container));
    },
};
exports.default = pingCommand;
