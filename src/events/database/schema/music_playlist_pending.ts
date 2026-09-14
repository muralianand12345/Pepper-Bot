import { Schema, model } from 'mongoose';

import { playlistTrackSchema } from './music_playlist';
import { IPlaylistPending } from '../../../types';

const playlistPendingSchema = new Schema<IPlaylistPending>({
	token: { type: String, required: true },
	userId: { type: String, required: true },
	code: { type: String, required: true },
	tracks: { type: [playlistTrackSchema], default: [] },
	expiresAt: { type: Date, required: true },
});

playlistPendingSchema.index({ token: 1 }, { unique: true });
playlistPendingSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model<IPlaylistPending>('music-playlist-pendings', playlistPendingSchema);
