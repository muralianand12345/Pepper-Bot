import { IPlayer } from "../types";

/**
 * A utility class for formatting text and time values
 */
class Formatter {
    /**
     * Converts milliseconds to a formatted time string (HH:MM:SS)
     *
     * @param ms - The number of milliseconds to convert
     * @returns Formatted time string in HH:MM:SS format
     * @example
     * ```typescript
     * Formatter.msToTime(3661000); // Returns "01:01:01"
     * ```
     */
    public static msToTime(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;

        const formattedHours = String(hours).padStart(2, "0");
        const formattedMinutes = String(minutes).padStart(2, "0");
        const formattedSeconds = String(remainingSeconds).padStart(2, "0");

        return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    }

    /**
     * Formats seconds into a readable duration string
     * @param seconds - Number of seconds to format
     * @returns Formatted duration string (e.g., "2d 5h 30m")
     * @example
     * ```typescript
     * Formatter.formatUptime(90061); // Returns "1d 1h 1m"
     * ```
     */
    public static formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor(((seconds % 86400) % 3600) / 60);
        const parts = [];

        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);

        return parts.join(" ") || "< 1m";
    }

    /**
     * Truncates text to a specified length and adds an ellipsis
     *
     * @param text - The text to truncate
     * @param maxLength - Maximum length of the text (default: 20)
     * @param ellipsis - String to append when text is truncated (default: '...')
     * @returns Truncated text with ellipsis if necessary
     * @example
     * ```typescript
     * Formatter.truncateText("This is a very long text", 10); // Returns "This is a..."
     * ```
     */
    public static truncateText(
        text: string,
        maxLength: number = 50,
        ellipsis: string = "..."
    ): string {
        if (Array.from(text).length > maxLength) {
            text = text.slice(0, maxLength) + ellipsis;
        }
        return text;
    }

    /**
     * Creates a markdown hyperlink with escaped brackets
     *
     * @param text - The text to display for the link
     * @param url - The URL for the link
     * @returns Formatted markdown hyperlink
     * @example
     * ```typescript
     * Formatter.hyperlink("Click here", "https://example.com");
     * // Returns "[Click here](https://example.com)"
     * ```
     */
    public static hyperlink(text: string, url: string): string {
        const escapedText = text.replace(/\[/g, "［").replace(/\]/g, "］");
        return `[${escapedText}](${url})`;
    }

    /**
     * Generates a progress bar for music player
     *
     * @param player - The player object containing position and duration information
     * @returns Formatted progress bar string
     * @example
     * ```typescript
     * const player = {
     *     position: 60000,
     *     queue: { current: { duration: 180000 } }
     * };
     * Formatter.createProgressBar(player);
     * // Returns "**[ ▬▬▬●▬▬▬▬▬▬▬▬▬▬▬ ]**"
     * ```
     */
    public static createProgressBar(player: IPlayer): string {
        const progress =
            (Math.floor(player.position / 1000) /
                Math.floor(player.queue.current.duration / 1000)) *
            100;
        const progressBlocks = Math.floor((progress * 1.5) / 10);

        let bar = "▬".repeat(Math.max(0, progressBlocks));
        bar += "●";
        bar += "▬".repeat(Math.max(0, 15 - progressBlocks));

        return `**[ ${bar} ]**`;
    }

    /**
     * Formats bytes into a human-readable string with appropriate units
     *
     * @param bytes - The number of bytes to format
     * @returns Formatted string with appropriate unit (B, KB, MB, GB, TB)
     * @example
     * ```typescript
     * Formatter.formatBytes(1024); // Returns "1 KB"
     * Formatter.formatBytes(1234567); // Returns "1.18 MB"
     * ```
     */
    public static formatBytes(bytes: number): string {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }
}

export default Formatter;
