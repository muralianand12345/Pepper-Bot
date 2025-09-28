import client from '../../../pepper';
import music_user from '../../../events/database/schema/music_user';
import music_guild from '../../../events/database/schema/music_guild';
import { IMusicUser, IMusicGuild, ISongs, ChartAnalytics } from '../../../types';

export class MusicDB {
	private static addMusicDB = async <T extends IMusicUser | IMusicGuild>(data: T, songs_data: ISongs): Promise<void> => {
		try {
			if (!data.songs) data.songs = [];
			if (!songs_data.artworkUrl || songs_data.artworkUrl.trim() === '') songs_data.artworkUrl = songs_data.thumbnail || 'https://media.istockphoto.com/id/1175435360/vector/music-note-icon-vector-illustration.jpg';
			const songExists = data.songs.find((song) => song.uri === songs_data.uri);
			if (songExists) {
				songExists.played_number += 1;
				songExists.timestamp = new Date();
			} else {
				data.songs.push(songs_data);
			}
			if ((data as any).dj !== undefined && (data as any).dj !== null && typeof (data as any).dj !== 'string') {
				try {
					client.logger.warn(`[MusicDB] Coercing non-string dj field to null. Value type=${typeof (data as any).dj}`);
				} catch {}
				(data as any).dj = null;
			}
			await data.save();
		} catch (err) {
			throw new Error(`An error occurred while adding music data: ${err}`);
		}
	};

	public static addMusicUserData = async (userId: string | null, data: ISongs): Promise<void> => {
		try {
			if (!userId) throw new Error('User ID is required to add music data');

			let user = await music_user.findOne({ userId });
			if (!user) {
				user = new music_user({ userId, songs: [data] });
				await user.save();
			} else {
				await this.addMusicDB(user, data);
			}
		} catch (err) {
			throw new Error(`Failed to add music user data: ${err}`);
		}
	};

	public static userExists = async (userId: string): Promise<boolean> => {
		if (!userId) return false;
		const count = await music_user.countDocuments({ userId });
		return count > 0;
	};

	public static atomicAddMusicUserData = async (userId: string, songData: ISongs): Promise<void> => {
		try {
			const user = await music_user.findOne({ userId, 'songs.uri': songData.uri });
			if (user) {
				await music_user.updateOne({ userId, 'songs.uri': songData.uri }, { $inc: { 'songs.$.played_number': 1 }, $set: { 'songs.$.timestamp': new Date() } });
			} else {
				const userExists = await this.userExists(userId);

				if (userExists) {
					await music_user.updateOne({ userId }, { $push: { songs: songData } });
				} else {
					await music_user.create({ userId, songs: [songData] });
				}
			}
		} catch (err) {
			throw new Error(`Failed to add music user data atomically: ${err}`);
		}
	};

	public static addMusicGuildData = async (guildId: string | null, data: ISongs): Promise<void> => {
		try {
			if (!guildId) throw new Error('Guild ID is required to add music data');

			let guild = await music_guild.findOne({ guildId });
			if (!guild) {
				guild = new music_guild({ guildId, dj: null, songs: [data] });
				await guild.save();
			} else {
				await this.addMusicDB(guild, data);
			}
		} catch (err) {
			throw new Error(`Failed to add music guild data: ${err}`);
		}
	};

	public static getUserMusicHistory = async (userId: string | null): Promise<{ songs: ISongs[] } | null> => {
		try {
			if (!userId) throw new Error('User ID is required to get music history');

			const user = await music_user.findOne({ userId });
			if (!user) return null;

			return { songs: user.songs || [] };
		} catch (err) {
			return { songs: [] };
		}
	};

	public static getGuildMusicHistory = async (guildId: string | null): Promise<{ songs: ISongs[] } | null> => {
		try {
			if (!guildId) throw new Error('Guild ID is required to get music history');

			const guild = await music_guild.findOne({ guildId });
			if (!guild) return null;

			return { songs: guild.songs || [] };
		} catch (err) {
			return { songs: [] };
		}
	};

	public static getGlobalMusicHistory = async (): Promise<{ songs: ISongs[] }> => {
		try {
			const allGuilds = await music_guild.find();
			if (!allGuilds || allGuilds.length === 0) return { songs: [] };

			const combinedSongs: Record<string, ISongs> = {};
			allGuilds.forEach((guild) => {
				if (!guild.songs || !Array.isArray(guild.songs)) return;

				guild.songs.forEach((song) => {
					if (!song.uri || !song.title || !song.author) return;
					if (!song.played_number || song.played_number <= 0) return;

					const key = song.uri;
					if (combinedSongs[key]) {
						combinedSongs[key].played_number += song.played_number;
					} else {
						combinedSongs[key] = {
							...song,
							title: song.title || 'Unknown Title',
							author: song.author || 'Unknown Artist',
							played_number: song.played_number || 0,
							duration: song.duration || 0,
							timestamp: song.timestamp || new Date(),
						};
					}
				});
			});

			const globalSongs = Object.values(combinedSongs)
				.filter((song) => song.played_number > 0)
				.sort((a, b) => b.played_number - a.played_number);
			return { songs: globalSongs };
		} catch (err) {
			return { songs: [] };
		}
	};

	public static removeUserSong = async (userId: string | null, uri: string): Promise<boolean> => {
		try {
			if (!userId) throw new Error('User ID is required to remove song');

			const user = await music_user.findOne({ userId });
			if (!user || !user.songs) return false;

			const initialLength = user.songs.length;
			user.songs = user.songs.filter((song) => song.uri !== uri);
			if (user.songs.length === initialLength) return false;

			await user.save();
			return true;
		} catch (err) {
			throw new Error(`Failed to remove user song: ${err}`);
		}
	};

	public static removeGuildSong = async (guildId: string | null, uri: string): Promise<boolean> => {
		try {
			if (!guildId) throw new Error('Guild ID is required to remove song');

			const guild = await music_guild.findOne({ guildId });
			if (!guild || !guild.songs) return false;

			const initialLength = guild.songs.length;
			guild.songs = guild.songs.filter((song) => song.uri !== uri);
			if (guild.songs.length === initialLength) return false;

			await guild.save();
			return true;
		} catch (err) {
			throw new Error(`Failed to remove guild song: ${err}`);
		}
	};

	public static clearUserHistory = async (userId: string | null): Promise<boolean> => {
		try {
			if (!userId) throw new Error('User ID is required to clear history');
			const result = await music_user.findOneAndUpdate({ userId }, { $set: { songs: [] } });
			return !!result;
		} catch (err) {
			throw new Error(`Failed to clear user music history: ${err}`);
		}
	};

	public static clearGuildHistory = async (guildId: string | null): Promise<boolean> => {
		try {
			if (!guildId) throw new Error('Guild ID is required to clear history');
			const result = await music_guild.findOneAndUpdate({ guildId }, { $set: { songs: [] } });
			return !!result;
		} catch (err) {
			throw new Error(`Failed to clear guild music history: ${err}`);
		}
	};

	public static getUserTopSongs = async (userId: string, limit: number = 20): Promise<ISongs[]> => {
		try {
			if (!userId) return [];
			const result = await music_user.aggregate([{ $match: { userId } }, { $unwind: '$songs' }, { $match: { 'songs.played_number': { $gt: 0 } } }, { $sort: { 'songs.played_number': -1 } }, { $limit: limit }, { $replaceRoot: { newRoot: '$songs' } }]);
			return result || [];
		} catch (err) {
			return [];
		}
	};

	public static getGuildTopSongs = async (guildId: string, limit: number = 20): Promise<ISongs[]> => {
		try {
			if (!guildId) return [];
			const result = await music_guild.aggregate([{ $match: { guildId } }, { $unwind: '$songs' }, { $match: { 'songs.played_number': { $gt: 0 } } }, { $sort: { 'songs.played_number': -1 } }, { $limit: limit }, { $replaceRoot: { newRoot: '$songs' } }]);
			return result || [];
		} catch (err) {
			return [];
		}
	};

	public static getGlobalTopSongs = async (limit: number = 20): Promise<ISongs[]> => {
		try {
			const result = await music_guild.aggregate([
				{ $unwind: '$songs' },
				{ $match: { 'songs.played_number': { $gt: 0 } } },
				{
					$group: {
						_id: '$songs.uri',
						title: { $first: '$songs.title' },
						author: { $first: '$songs.author' },
						duration: { $first: '$songs.duration' },
						artworkUrl: { $first: '$songs.artworkUrl' },
						thumbnail: { $first: '$songs.thumbnail' },
						sourceName: { $first: '$songs.sourceName' },
						uri: { $first: '$songs.uri' },
						track: { $first: '$songs.track' },
						identifier: { $first: '$songs.identifier' },
						isrc: { $first: '$songs.isrc' },
						isSeekable: { $first: '$songs.isSeekable' },
						isStream: { $first: '$songs.isStream' },
						requester: { $first: '$songs.requester' },
						played_number: { $sum: '$songs.played_number' },
						timestamp: { $max: '$songs.timestamp' },
					},
				},
				{ $match: { played_number: { $gt: 0 } } },
				{ $sort: { played_number: -1 } },
				{ $limit: limit },
			]);
			return result || [];
		} catch (err) {
			client.logger.error(`Error in getGlobalTopSongs: ${err}`);
			return [];
		}
	};

	public static getUserMusicAnalytics = async (userId: string): Promise<ChartAnalytics | null> => {
		try {
			if (!userId) return null;
			const result = await music_user.aggregate([
				{ $match: { userId } },
				{ $unwind: '$songs' },
				{ $match: { 'songs.played_number': { $gt: 0 } } },
				{
					$group: {
						_id: null,
						totalSongs: { $sum: 1 },
						uniqueArtists: { $addToSet: { $toLower: '$songs.author' } },
						totalPlaytime: { $sum: { $multiply: ['$songs.duration', '$songs.played_number'] } },
						totalPlays: { $sum: '$songs.played_number' },
						recentActivity: { $sum: { $cond: [{ $gte: ['$songs.timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] }, 1, 0] } },
					},
				},
				{
					$project: {
						totalSongs: 1,
						uniqueArtists: { $size: '$uniqueArtists' },
						totalPlaytime: 1,
						recentActivity: 1,
						averagePlayCount: { $cond: [{ $gt: ['$totalSongs', 0] }, { $divide: ['$totalPlays', '$totalSongs'] }, 0] },
					},
				},
			]);
			if (!result || result.length === 0) {
				return { totalSongs: 0, uniqueArtists: 0, totalPlaytime: 0, topGenres: {}, recentActivity: 0, averagePlayCount: 0 };
			}
			const analytics = result[0];
			analytics.topGenres = {};
			return analytics;
		} catch (err) {
			return null;
		}
	};

	public static getGuildMusicAnalytics = async (guildId: string): Promise<ChartAnalytics | null> => {
		try {
			if (!guildId) return null;
			const result = await music_guild.aggregate([
				{ $match: { guildId } },
				{ $unwind: '$songs' },
				{ $match: { 'songs.played_number': { $gt: 0 } } },
				{
					$group: {
						_id: null,
						totalSongs: { $sum: 1 },
						uniqueArtists: { $addToSet: { $toLower: '$songs.author' } },
						totalPlaytime: { $sum: { $multiply: ['$songs.duration', '$songs.played_number'] } },
						totalPlays: { $sum: '$songs.played_number' },
						recentActivity: { $sum: { $cond: [{ $gte: ['$songs.timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] }, 1, 0] } },
					},
				},
				{
					$project: {
						totalSongs: 1,
						uniqueArtists: { $size: '$uniqueArtists' },
						totalPlaytime: 1,
						recentActivity: 1,
						averagePlayCount: { $cond: [{ $gt: ['$totalSongs', 0] }, { $divide: ['$totalPlays', '$totalSongs'] }, 0] },
					},
				},
			]);

			if (!result || result.length === 0) return { totalSongs: 0, uniqueArtists: 0, totalPlaytime: 0, topGenres: {}, recentActivity: 0, averagePlayCount: 0 };

			const analytics = result[0];
			analytics.topGenres = {};
			return analytics;
		} catch (err) {
			return null;
		}
	};

	public static getGlobalMusicAnalytics = async (): Promise<ChartAnalytics | null> => {
		try {
			const result = await music_guild.aggregate([
				{ $unwind: '$songs' },
				{ $match: { 'songs.played_number': { $gt: 0 } } },
				{
					$group: {
						_id: '$songs.uri',
						author: { $first: '$songs.author' },
						duration: { $first: '$songs.duration' },
						sourceName: { $first: '$songs.sourceName' },
						played_number: { $sum: '$songs.played_number' },
						timestamp: { $max: '$songs.timestamp' },
					},
				},
				{ $match: { played_number: { $gt: 0 } } },
				{
					$group: {
						_id: null,
						totalSongs: { $sum: 1 },
						uniqueArtists: { $addToSet: { $toLower: '$author' } },
						totalPlaytime: { $sum: { $multiply: ['$duration', '$played_number'] } },
						totalPlays: { $sum: '$played_number' },
						recentActivity: { $sum: { $cond: [{ $gte: ['$timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] }, 1, 0] } },
					},
				},
				{
					$project: {
						totalSongs: 1,
						uniqueArtists: { $size: '$uniqueArtists' },
						totalPlaytime: 1,
						recentActivity: 1,
						averagePlayCount: { $cond: [{ $gt: ['$totalSongs', 0] }, { $divide: ['$totalPlays', '$totalSongs'] }, 0] },
					},
				},
			]);

			if (!result || result.length === 0) return { totalSongs: 0, uniqueArtists: 0, totalPlaytime: 0, topGenres: {}, recentActivity: 0, averagePlayCount: 0 };

			const analytics = result[0];
			analytics.topGenres = {};
			return analytics;
		} catch (err) {
			client.logger.error(`Error in getGlobalMusicAnalytics: ${err}`);
			return null;
		}
	};
}
