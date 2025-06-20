import mongoose from 'mongoose';

import { ISongs } from './music';

export interface IMusicGuild extends mongoose.Document {
	guildId: string;
	language?: string | null;
	totalGuildXP: number;
	activeMembers: number;
	lastActivity: Date;
	songs: Array<ISongs>;
}

export interface IMusicUser extends mongoose.Document {
	userId: string;
	language?: string | null;
	totalXP: number;
	currentLevel: number;
	lastXPGain: Date;
	listeningStartTime?: Date | null;
	dailyXP: number;
	weeklyXP: number;
	monthlyXP: number;
	lastDailyReset: Date;
	lastWeeklyReset: Date;
	lastMonthlyReset: Date;
	xpMultiplier: number;
	streakDays: number;
	lastActiveDate: Date;
	songs: Array<ISongs>;
}
