import { IPlayer } from '../types';

/**
 * A utility class for formatting text and time values
 */
class Formatter {
	/**
	 * Converts milliseconds to a formatted time string (HH:MM:SS)
	 * @param ms - Time in milliseconds
	 * @returns Formatted time string
	 */
	public static msToTime = (ms: number): string => {
		const seconds = Math.floor(ms / 1000);
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const remainingSeconds = seconds % 60;

		const formattedHours = String(hours).padStart(2, '0');
		const formattedMinutes = String(minutes).padStart(2, '0');
		const formattedSeconds = String(remainingSeconds).padStart(2, '0');

		return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
	};

	/**
	 * Formats a duration in seconds into a human-readable string
	 * @param seconds - Duration in seconds
	 * @returns Formatted duration string
	 */
	public static formatUptime = (seconds: number): string => {
		const years = Math.floor(seconds / 31536000);
		const months = Math.floor(seconds / 2592000);
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const minutes = Math.floor(((seconds % 86400) % 3600) / 60);
		const parts = [];

		if (years > 0) parts.push(`${years}y`);
		if (months > 0) parts.push(`${months}mo`);
		if (days > 0) parts.push(`${days}d`);
		if (hours > 0) parts.push(`${hours}h`);
		if (minutes > 0) parts.push(`${minutes}m`);

		return parts.join(' ') || '< 1m';
	};

	/**
	 * Formats a listening time in seconds into a human-readable string
	 * @param seconds - Listening time in seconds
	 * @returns Formatted listening time string
	 */
	public static formatListeningTime = (seconds: number): string => {
		if (seconds < 60) return '< 1m';

		let remaining = Math.floor(seconds);
		const parts = [];

		const years = Math.floor(remaining / 31536000);
		remaining %= 31536000;

		const months = Math.floor(remaining / 2592000);
		remaining %= 2592000;

		const days = Math.floor(remaining / 86400);
		remaining %= 86400;

		const hours = Math.floor(remaining / 3600);
		remaining %= 3600;

		const minutes = Math.floor(remaining / 60);

		if (years > 0) {
			parts.push(`${years}y`);
			if (months > 0) parts.push(`${months}mo`);
			return parts.join(' ');
		}

		if (months > 0) {
			parts.push(`${months}mo`);
			if (days > 0) parts.push(`${days}d`);
			return parts.join(' ');
		}

		if (days > 0) {
			parts.push(`${days}d`);
			if (hours > 0) parts.push(`${hours}h`);
			return parts.join(' ');
		}

		if (hours > 0) {
			parts.push(`${hours}h`);
			if (minutes > 0) parts.push(`${minutes}m`);
			return parts.join(' ');
		}

		return `${minutes}m`;
	};

	/**
	 * Truncates text to a specified length and appends an ellipsis if necessary
	 * @param text - The text to truncate
	 * @param maxLength - Maximum length of the text
	 * @param ellipsis - String to append if text is truncated
	 * @returns Truncated text
	 */
	public static truncateText = (text: string, maxLength: number = 50, ellipsis: string = '...'): string => {
		if (Array.from(text).length > maxLength) text = text.slice(0, maxLength) + ellipsis;
		return text;
	};

	/**
	 * Formats a string as a hyperlink
	 * @param text - The text to display
	 * @param url - The URL to link to
	 * @returns Formatted hyperlink string
	 */
	public static hyperlink = (text: string, url: string): string => {
		const escapedText = text.replace(/\[/g, '［').replace(/\]/g, '］');
		return `[${escapedText}](${url})`;
	};

	/**
	 * Creates a progress bar for the current position in a track
	 * @param player - The player object containing position and queue information
	 * @returns Formatted progress bar string
	 */
	public static createProgressBar = (player: IPlayer): string => {
		const progress = (Math.floor(player.position / 1000) / Math.floor(player.queue.current.duration / 1000)) * 100;
		const progressBlocks = Math.floor((progress * 1.5) / 10);

		let bar = '▬'.repeat(Math.max(0, progressBlocks));
		bar += '●';
		bar += '▬'.repeat(Math.max(0, 15 - progressBlocks));

		return `**${bar}**`;
	};

	/**
	 * Formats a number of bytes into a human-readable string
	 * @param bytes - The number of bytes
	 * @returns Formatted byte string
	 */
	public static formatBytes = (bytes: number): string => {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
	};
}

export default Formatter;
