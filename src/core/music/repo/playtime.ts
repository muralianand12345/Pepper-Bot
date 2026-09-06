/**
 * Live streams are stored with a `Long.MAX_VALUE` duration, so multiplying one
 * by its play count swamps every playtime total it lands in. Nothing longer
 * than this is a real track, so those rows contribute no listening time.
 */
export const MAX_TRACK_DURATION_MS = 24 * 60 * 60 * 1000;

/** `$sum` of duration x plays, skipping rows whose duration is not a real track length. */
export const playtimeSum = (duration: string, plays: string) => ({
	$sum: { $cond: [{ $and: [{ $gt: [duration, 0] }, { $lte: [duration, MAX_TRACK_DURATION_MS] }] }, { $multiply: [duration, plays] }, 0] },
});
