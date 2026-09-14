import crypto from 'crypto';

import music_playlist from '../../../events/database/schema/music_playlist';
import music_playlist_pending from '../../../events/database/schema/music_playlist_pending';
import { IPlaylistTrack, PlaylistPendingRecord, PlaylistRecord, PlaylistSummary, PlaylistVisibility } from '../../../types';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_ATTEMPTS = 5;

export type PlaylistEditResult = { status: 'ok'; playlist: PlaylistRecord; track: IPlaylistTrack } | { status: 'not_found' | 'invalid_position' | 'conflict' };
export type PlaylistTransferResult = { status: 'ok'; playlist: PlaylistRecord } | { status: 'expired' | 'name_taken' };

const isDuplicateKey = (error: unknown, field: string): boolean => {
	const mongoError = error as { code?: number; keyPattern?: Record<string, unknown> } | null;
	return mongoError?.code === 11000 && Boolean(mongoError.keyPattern?.[field]);
};

const nameKeyOf = (name: string): string => name.toLowerCase();

const audioProjection = (withAudio: boolean): Record<string, 0> => (withAudio ? {} : { 'tracks.encoded': 0 });

export class PlaylistDB {
	public static readonly CODE_PATTERN = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

	private static generateCode = (): string => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');

	public static findByCode = async (code: string, withAudio: boolean = true): Promise<PlaylistRecord | null> => {
		return music_playlist.findOne({ code }, audioProjection(withAudio)).lean<PlaylistRecord>().exec();
	};

	public static findByOwnerAndName = async (ownerId: string, name: string, withAudio: boolean = true): Promise<PlaylistRecord | null> => {
		return music_playlist.findOne({ ownerId, nameKey: nameKeyOf(name) }, audioProjection(withAudio)).lean<PlaylistRecord>().exec();
	};

	public static getSummaries = async (filter: { ownerId: string } | { code: string }): Promise<PlaylistSummary[]> => {
		return music_playlist.aggregate<PlaylistSummary>([{ $match: filter }, { $sort: { createdAt: 1 } }, { $project: { _id: 0, code: 1, ownerId: 1, name: 1, visibility: 1, createdAt: 1, trackCount: { $size: '$tracks' } } }]).exec();
	};

	public static countByOwner = async (ownerId: string): Promise<number> => {
		return music_playlist.countDocuments({ ownerId }).exec();
	};

	public static nameTaken = async (ownerId: string, name: string): Promise<boolean> => {
		return Boolean(await music_playlist.exists({ ownerId, nameKey: nameKeyOf(name) }).exec());
	};

	public static create = async (ownerId: string, name: string, visibility: PlaylistVisibility): Promise<{ status: 'ok'; playlist: PlaylistRecord } | { status: 'name_taken' }> => {
		for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
			try {
				const created = await music_playlist.create({ code: this.generateCode(), ownerId, name, nameKey: nameKeyOf(name), visibility, tracks: [], transfer: null });
				return { status: 'ok', playlist: created.toObject() as unknown as PlaylistRecord };
			} catch (error) {
				if (isDuplicateKey(error, 'nameKey')) return { status: 'name_taken' };
				if (!isDuplicateKey(error, 'code')) throw error;
			}
		}
		throw new Error(`Failed to generate a unique playlist code after ${CODE_ATTEMPTS} attempts`);
	};

	public static delete = async (code: string, ownerId: string): Promise<boolean> => {
		const result = await music_playlist.deleteOne({ code, ownerId }).exec();
		return result.deletedCount > 0;
	};

	public static rename = async (code: string, ownerId: string, name: string): Promise<'ok' | 'not_found' | 'name_taken'> => {
		try {
			const result = await music_playlist.updateOne({ code, ownerId }, { $set: { name, nameKey: nameKeyOf(name) }, $inc: { revision: 1 } }).exec();
			return result.matchedCount > 0 ? 'ok' : 'not_found';
		} catch (error) {
			if (isDuplicateKey(error, 'nameKey')) return 'name_taken';
			throw error;
		}
	};

	/** Counts a play from `/play`. Tracked for every playlist; only public ones are exposed through the stats API. */
	public static recordPlay = async (code: string): Promise<void> => {
		await music_playlist.updateOne({ code }, { $inc: { playCount: 1 }, $set: { lastPlayedAt: new Date() } }).exec();
	};

	public static setVisibility = async (code: string, ownerId: string, visibility: PlaylistVisibility): Promise<boolean> => {
		const result = await music_playlist.updateOne({ code, ownerId }, { $set: { visibility } }).exec();
		return result.matchedCount > 0;
	};

	/** Appends a track only while the playlist is below `limit`, so concurrent adds from other shards can't overfill it. */
	public static addTrack = async (code: string, ownerId: string, track: IPlaylistTrack, limit: number): Promise<PlaylistRecord | null> => {
		const lastSlot = `tracks.${Math.max(1, limit) - 1}`;
		return music_playlist.findOneAndUpdate({ code, ownerId, [lastSlot]: { $exists: false } }, { $push: { tracks: track }, $inc: { revision: 1 } }, { returnDocument: 'after' }).lean<PlaylistRecord>().exec();
	};

	private static findOwned = async (code: string, ownerId: string): Promise<PlaylistRecord | null> => {
		return music_playlist.findOne({ code, ownerId }).lean<PlaylistRecord>().exec();
	};

	/** Rewrites the track list only if nobody changed the playlist since it was read. */
	private static replaceTracks = async (playlist: PlaylistRecord, tracks: IPlaylistTrack[]): Promise<PlaylistRecord | null> => {
		return music_playlist.findOneAndUpdate({ code: playlist.code, ownerId: playlist.ownerId, revision: playlist.revision }, { $set: { tracks }, $inc: { revision: 1 } }, { returnDocument: 'after' }).lean<PlaylistRecord>().exec();
	};

	public static removeTrack = async (code: string, ownerId: string, position: number): Promise<PlaylistEditResult> => {
		const playlist = await this.findOwned(code, ownerId);
		if (!playlist) return { status: 'not_found' };
		if (position < 1 || position > playlist.tracks.length) return { status: 'invalid_position' };

		const tracks = [...playlist.tracks];
		const [track] = tracks.splice(position - 1, 1);
		const updated = await this.replaceTracks(playlist, tracks);
		return updated ? { status: 'ok', playlist: updated, track } : { status: 'conflict' };
	};

	public static moveTrack = async (code: string, ownerId: string, from: number, to: number): Promise<PlaylistEditResult> => {
		const playlist = await this.findOwned(code, ownerId);
		if (!playlist) return { status: 'not_found' };
		const size = playlist.tracks.length;
		if (from < 1 || from > size || to < 1 || to > size) return { status: 'invalid_position' };

		const tracks = [...playlist.tracks];
		const [track] = tracks.splice(from - 1, 1);
		tracks.splice(to - 1, 0, track);
		const updated = await this.replaceTracks(playlist, tracks);
		return updated ? { status: 'ok', playlist: updated, track } : { status: 'conflict' };
	};

	public static requestTransfer = async (code: string, ownerId: string, toUserId: string, expiresAt: Date): Promise<boolean> => {
		const result = await music_playlist.updateOne({ code, ownerId }, { $set: { transfer: { toUserId, expiresAt } } }).exec();
		return result.matchedCount > 0;
	};

	public static cancelTransfer = async (code: string, ownerId: string, toUserId: string): Promise<boolean> => {
		const result = await music_playlist.updateOne({ code, ownerId, 'transfer.toUserId': toUserId }, { $set: { transfer: null } }).exec();
		return result.matchedCount > 0;
	};

	public static completeTransfer = async (code: string, fromOwnerId: string, toUserId: string): Promise<PlaylistTransferResult> => {
		try {
			const playlist = await music_playlist.findOneAndUpdate({ code, ownerId: fromOwnerId, 'transfer.toUserId': toUserId, 'transfer.expiresAt': { $gt: new Date() } }, { $set: { ownerId: toUserId, transfer: null }, $inc: { revision: 1 } }, { returnDocument: 'after' }).lean<PlaylistRecord>().exec();
			return playlist ? { status: 'ok', playlist } : { status: 'expired' };
		} catch (error) {
			if (isDuplicateKey(error, 'nameKey')) return { status: 'name_taken' };
			throw error;
		}
	};

	public static createPending = async (userId: string, code: string, tracks: IPlaylistTrack[], ttlMs: number): Promise<string> => {
		const token = crypto.randomBytes(8).toString('hex');
		await music_playlist_pending.create({ token, userId, code, tracks, expiresAt: new Date(Date.now() + ttlMs) });
		return token;
	};

	public static getPending = async (token: string, userId: string): Promise<PlaylistPendingRecord | null> => {
		return music_playlist_pending.findOne({ token, userId, expiresAt: { $gt: new Date() } }).lean<PlaylistPendingRecord>().exec();
	};

	public static deletePending = async (token: string, userId: string): Promise<void> => {
		await music_playlist_pending.deleteOne({ token, userId }).exec();
	};
}
