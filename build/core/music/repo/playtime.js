"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playtimeSum = exports.MAX_TRACK_DURATION_MS = void 0;
/**
 * Live streams are stored with a `Long.MAX_VALUE` duration, so multiplying one
 * by its play count swamps every playtime total it lands in. Nothing longer
 * than this is a real track, so those rows contribute no listening time.
 */
exports.MAX_TRACK_DURATION_MS = 24 * 60 * 60 * 1000;
/** `$sum` of duration x plays, skipping rows whose duration is not a real track length. */
const playtimeSum = (duration, plays) => ({
    $sum: { $cond: [{ $and: [{ $gt: [duration, 0] }, { $lte: [duration, exports.MAX_TRACK_DURATION_MS] }] }, { $multiply: [duration, plays] }, 0] },
});
exports.playtimeSum = playtimeSum;
