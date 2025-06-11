import { IPlayer } from "../types";

/**
 * A utility class for formatting text and time values
 */
class Formatter {

    public static msToTime = (ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        const formattedHours = String(hours).padStart(2, "0");
        const formattedMinutes = String(minutes).padStart(2, "0");
        const formattedSeconds = String(remainingSeconds).padStart(2, "0");

        return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    }

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

        return parts.join(" ") || "< 1m";
    }

    public static truncateText = (text: string, maxLength: number = 50, ellipsis: string = "..."): string => {
        if (Array.from(text).length > maxLength) {
            text = text.slice(0, maxLength) + ellipsis;
        }
        return text;
    }

    public static hyperlink = (text: string, url: string): string => {
        const escapedText = text.replace(/\[/g, "［").replace(/\]/g, "］");
        return `[${escapedText}](${url})`;
    }

    public static createProgressBar = (player: IPlayer): string => {
        const progress = (Math.floor(player.position / 1000) / Math.floor(player.queue.current.duration / 1000)) * 100;
        const progressBlocks = Math.floor((progress * 1.5) / 10);

        let bar = "▬".repeat(Math.max(0, progressBlocks));
        bar += "●";
        bar += "▬".repeat(Math.max(0, 15 - progressBlocks));

        return `**[ ${bar} ]**`;
    }

    public static formatBytes = (bytes: number): string => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }
}

export default Formatter;
