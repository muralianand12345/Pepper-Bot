import { IMusicGuild } from '../../../../types';
import music_guild from '../../../../events/database/schema/music_guild';

export class XPGuildRepo {
	public getGuild = async (guildId: string): Promise<IMusicGuild | null> => {
		try {
			return await music_guild.findOne({ guildId }).lean();
		} catch (error) {
			throw new Error(`Failed to get guild: ${error}`);
		}
	};

	public getOrCreateGuild = async (guildId: string): Promise<IMusicGuild> => {
		try {
			let guild = await music_guild.findOne({ guildId });

			if (!guild) {
				guild = new music_guild({
					guildId,
					totalGuildXP: 0,
					activeMembers: 0,
					lastActivity: new Date(),
					songs: [],
				});
				await guild.save();
			}

			return guild;
		} catch (error) {
			throw new Error(`Failed to get or create guild: ${error}`);
		}
	};

	public addGuildXP = async (guildId: string, xpAmount: number): Promise<void> => {
		try {
			await music_guild.updateOne({ guildId }, { $inc: { totalGuildXP: xpAmount }, $set: { lastActivity: new Date() } }, { upsert: true });
		} catch (error) {
			throw new Error(`Failed to add guild XP: ${error}`);
		}
	};

	public updateActiveMembers = async (guildId: string, memberCount: number): Promise<void> => {
		try {
			await music_guild.updateOne({ guildId }, { $set: { activeMembers: memberCount } }, { upsert: true });
		} catch (error) {
			throw new Error(`Failed to update active members: ${error}`);
		}
	};

	public getTopGuilds = async (limit: number = 10): Promise<IMusicGuild[]> => {
		try {
			return await music_guild.find({}).sort({ totalGuildXP: -1 }).limit(limit).lean();
		} catch (error) {
			throw new Error(`Failed to get top guilds: ${error}`);
		}
	};

	public getGuildRank = async (guildId: string): Promise<number> => {
		try {
			const guild = await music_guild.findOne({ guildId });
			if (!guild) return 0;
			const rank = await music_guild.countDocuments({ totalGuildXP: { $gt: guild.totalGuildXP } });
			return rank + 1;
		} catch (error) {
			throw new Error(`Failed to get guild rank: ${error}`);
		}
	};
}
