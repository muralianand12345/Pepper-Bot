export const MAX_TRACK_DURATION_MS = 24 * 60 * 60 * 1000;

export const playtimeSum = (duration: string, plays: string) => ({
	$sum: { $cond: [{ $and: [{ $gt: [duration, 0] }, { $lte: [duration, MAX_TRACK_DURATION_MS] }] }, { $multiply: [duration, plays] }, 0] },
});
