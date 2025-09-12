import mongoose from 'mongoose';
import discord from 'discord.js';

import { Command, CommandCategory } from '../types';
import { LocalizationManager, LocaleDetector } from '../core/locales';

const localizationManager = LocalizationManager.getInstance();
const localeDetector = new LocaleDetector();

const pingCommand: Command = {
	cooldown: 3600,
	category: CommandCategory.UTILITY,
	data: new discord.SlashCommandBuilder().setName('ping').setDescription("Check the bot's latency and connection status").setNameLocalizations(localizationManager.getCommandLocalizations('commands.ping.name')).setDescriptionLocalizations(localizationManager.getCommandLocalizations('commands.ping.description')),
	execute: async (interaction: discord.ChatInputCommandInteraction, client: discord.Client): Promise<void> => {
		const t = await localeDetector.getTranslator(interaction);
		const isOwner = client.config.bot.owners.includes(interaction.user.id);

		const startTime = Date.now();
		await interaction.deferReply();
		const endTime = Date.now();

		const apiLatency = endTime - startTime;
		const wsLatency = client.ws.ping;

		const getDatabaseLatency = async (): Promise<number> => {
			try {
				const dbStart = Date.now();
				if (!mongoose.connection.db) return -1;
				await mongoose.connection.db.admin().ping();
				return Date.now() - dbStart;
			} catch (error) {
				return -1;
			}
		};

		const dbLatency = await getDatabaseLatency();

		const getLatencyEmoji = (latency: number): string => {
			if (latency === -1) return '❌';
			if (latency < 150) return '🟢';
			if (latency < 350) return '🟡';
			return '🔴';
		};

		const getNodeStatus = (): string => {
			const connectedNodes = client.manager.nodes.filter((node) => node.connected);
			const totalNodes = client.manager.nodes.size;
			if (connectedNodes.size === 0) return '❌ No nodes connected';
			if (connectedNodes.size === totalNodes) return '🟢 All nodes connected';
			return `🟡 ${connectedNodes.size}/${totalNodes} nodes connected`;
		};

		const getPlayerInfo = async (): Promise<string> => {
			if (!isOwner) return '';

			const players = Array.from(client.manager.players.values());
			if (players.length === 0) return 'No active players';
			const playerInfos = await Promise.all(
				players.map(async (player) => {
					const guild = client.guilds.cache.get(player.guildId);
					const voiceChannel = client.channels.cache.get(player.voiceChannelId || '');
					const currentTrack = await player.queue.getCurrent();
					const guildName = guild?.name || 'Unknown Guild';
					const channelName = voiceChannel && 'name' in voiceChannel ? voiceChannel.name : 'Unknown Channel';
					const trackInfo = currentTrack ? `${currentTrack.title} - ${currentTrack.author}`.slice(0, 50) : 'No track playing';
					const status = player.playing ? '▶️' : player.paused ? '⏸️' : '⏹️';
					const queueSize = await player.queue.size();
					return `${status} **${guildName}**\n` + `└ Channel: ${channelName}\n` + `└ Track: ${trackInfo}\n` + `└ Queue: ${queueSize + 1} songs\n` + `└ Node: ${player.node.options.identifier}`;
				})
			);
			return playerInfos.join('\n\n');
		};

		const embed = new discord.EmbedBuilder()
			.setColor('#5865f2')
			.setTitle(t('responses.ping.title'))
			.setDescription(t('responses.ping.description'))
			.addFields([
				{ name: t('responses.ping.api_latency'), value: `${getLatencyEmoji(apiLatency)} ${apiLatency}ms`, inline: true },
				{ name: t('responses.ping.websocket_latency'), value: `${getLatencyEmoji(wsLatency)} ${wsLatency}ms`, inline: true },
				{ name: t('responses.ping.database_latency'), value: dbLatency === -1 ? '❌ Connection failed' : `${getLatencyEmoji(dbLatency)} ${dbLatency}ms`, inline: true },
				{ name: t('responses.ping.music_nodes'), value: getNodeStatus(), inline: false },
				{ name: t('responses.ping.uptime'), value: `<t:${Math.floor((Date.now() - (client.uptime || 0)) / 1000)}:R>`, inline: true },
				{ name: t('responses.ping.memory_usage'), value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
			])
			.setFooter({ text: t('responses.ping.footer'), iconURL: client.user?.displayAvatarURL() })
			.setTimestamp();

		if (isOwner) {
			const playerInfo = await getPlayerInfo();
			embed.addFields([{ name: t('responses.ping.active_players'), value: playerInfo.length > 1024 ? playerInfo.substring(0, 1021) + '...' : playerInfo || 'No active players', inline: false }]);
		}
		await interaction.editReply({ embeds: [embed] });
	},
};

export default pingCommand;
