import music_user from "../../events/database/schema/music_user";
import { IMusicUser, ISongs } from "../../types";

const addMusicUserData = async (userId: string | null, data: ISongs) => {
    try {
        if (!userId) new Error("User ID is required to add music data");
        var user = await music_user.findOne({ userId });
        if (!user) {
            user = new music_user({
                userId,
                songs: [data],
            });
        } else {
            const songExists = user.songs.find((song) => song.url === data.url);
            if (songExists) {
                songExists.played_number += 1;
                songExists.timestamp = new Date();
            } else {
                user.songs.push(data);
            }
        }

        await user.save();
    } catch (err) {
        new Error(`An error occurred while adding music-user data: ${err}`);
    }
};

export { addMusicUserData };
