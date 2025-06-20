import { IMusicUser } from '../../../../types';
import music_user from '../../../../events/database/schema/music_user';

export class XPUserRepo {
	public getUser = async (userId: string): Promise<IMusicUser | null> => {
		try {
			return await music_user.findOne({ userId }).lean();
		} catch (error) {
			throw new Error(`Failed to get user: ${error}`);
		}
	};

	public getOrCreateUser = async (userId: string): Promise<IMusicUser> => {
		try {
			let user = await music_user.findOne({ userId });

			if (!user) {
				user = new music_user({
					userId,
					totalXP: 0,
					currentLevel: 1,
					lastXPGain: new Date(),
					dailyXP: 0,
					weeklyXP: 0,
					monthlyXP: 0,
					lastDailyReset: new Date(),
					lastWeeklyReset: new Date(),
					lastMonthlyReset: new Date(),
					xpMultiplier: 1.0,
					streakDays: 0,
					lastActiveDate: new Date(),
					songs: [],
				});
				await user.save();
			}

			return user;
		} catch (error) {
			throw new Error(`Failed to get or create user: ${error}`);
		}
	};

	public addXP = async (userId: string, xpAmount: number): Promise<IMusicUser> => {
		try {
			const now = new Date();

			const user = await this.getOrCreateUser(userId);
			const updates: any = { $inc: { totalXP: xpAmount, dailyXP: xpAmount, weeklyXP: xpAmount, monthlyXP: xpAmount }, $set: { lastXPGain: now, lastActiveDate: now } };
			const daysSinceDaily = Math.floor((now.getTime() - new Date(user.lastDailyReset).getTime()) / (1000 * 60 * 60 * 24));
			if (daysSinceDaily >= 1) {
				updates.$set.dailyXP = xpAmount;
				updates.$set.lastDailyReset = now;

				if (daysSinceDaily === 1) {
					updates.$inc.streakDays = 1;
				} else {
					updates.$set.streakDays = 1;
				}
			}

			const daysSinceWeekly = Math.floor((now.getTime() - new Date(user.lastWeeklyReset).getTime()) / (1000 * 60 * 60 * 24));
			if (daysSinceWeekly >= 7) {
				updates.$set.weeklyXP = xpAmount;
				updates.$set.lastWeeklyReset = now;
			}

			const daysSinceMonthly = Math.floor((now.getTime() - new Date(user.lastMonthlyReset).getTime()) / (1000 * 60 * 60 * 24));
			if (daysSinceMonthly >= 30) {
				updates.$set.monthlyXP = xpAmount;
				updates.$set.lastMonthlyReset = now;
			}

			const updatedUser = await music_user.findOneAndUpdate({ userId }, updates, { new: true, upsert: true });
			if (!updatedUser) throw new Error('Failed to update user XP');
			return updatedUser;
		} catch (error) {
			throw new Error(`Failed to add XP: ${error}`);
		}
	};

	public updateLevel = async (userId: string, newLevel: number): Promise<void> => {
		try {
			await music_user.updateOne({ userId }, { $set: { currentLevel: newLevel } });
		} catch (error) {
			throw new Error(`Failed to update level: ${error}`);
		}
	};

	public setListeningStart = async (userId: string, startTime: Date): Promise<void> => {
		try {
			await music_user.updateOne({ userId }, { $set: { listeningStartTime: startTime } });
		} catch (error) {
			throw new Error(`Failed to set listening start: ${error}`);
		}
	};

	public clearListeningStart = async (userId: string): Promise<void> => {
		try {
			await music_user.updateOne({ userId }, { $unset: { listeningStartTime: 1 } });
		} catch (error) {
			throw new Error(`Failed to clear listening start: ${error}`);
		}
	};

	public getTopUsers = async (limit: number = 10): Promise<IMusicUser[]> => {
		try {
			return await music_user.find({}).sort({ totalXP: -1 }).limit(limit).lean();
		} catch (error) {
			throw new Error(`Failed to get top users: ${error}`);
		}
	};

	public getUserGlobalRank = async (userId: string): Promise<number> => {
		try {
			const user = await music_user.findOne({ userId });
			if (!user) return 0;
			const rank = await music_user.countDocuments({ totalXP: { $gt: user.totalXP } });
			return rank + 1;
		} catch (error) {
			throw new Error(`Failed to get user global rank: ${error}`);
		}
	};

	public getTopDailyUsers = async (limit: number = 10): Promise<IMusicUser[]> => {
		try {
			return await music_user
				.find({ dailyXP: { $gt: 0 } })
				.sort({ dailyXP: -1 })
				.limit(limit)
				.lean();
		} catch (error) {
			throw new Error(`Failed to get top daily users: ${error}`);
		}
	};

	public getTopWeeklyUsers = async (limit: number = 10): Promise<IMusicUser[]> => {
		try {
			return await music_user
				.find({ weeklyXP: { $gt: 0 } })
				.sort({ weeklyXP: -1 })
				.limit(limit)
				.lean();
		} catch (error) {
			throw new Error(`Failed to get top weekly users: ${error}`);
		}
	};

	public resetDailyXP = async (): Promise<void> => {
		try {
			await music_user.updateMany({}, { $set: { dailyXP: 0, lastDailyReset: new Date() } });
		} catch (error) {
			throw new Error(`Failed to reset daily XP: ${error}`);
		}
	};

	public resetWeeklyXP = async (): Promise<void> => {
		try {
			await music_user.updateMany({}, { $set: { weeklyXP: 0, lastWeeklyReset: new Date() } });
		} catch (error) {
			throw new Error(`Failed to reset weekly XP: ${error}`);
		}
	};

	public resetMonthlyXP = async (): Promise<void> => {
		try {
			await music_user.updateMany({}, { $set: { monthlyXP: 0, lastMonthlyReset: new Date() } });
		} catch (error) {
			throw new Error(`Failed to reset monthly XP: ${error}`);
		}
	};

	public updateStreak = async (userId: string, streakDays: number): Promise<void> => {
		try {
			await music_user.updateOne({ userId }, { $set: { streakDays } });
		} catch (error) {
			throw new Error(`Failed to update streak: ${error}`);
		}
	};

	public setMultiplier = async (userId: string, multiplier: number): Promise<void> => {
		try {
			await music_user.updateOne({ userId }, { $set: { xpMultiplier: multiplier } });
		} catch (error) {
			throw new Error(`Failed to set multiplier: ${error}`);
		}
	};
}
