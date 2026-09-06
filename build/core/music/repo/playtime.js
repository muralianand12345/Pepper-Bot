"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playtimeSum = exports.MAX_TRACK_DURATION_MS = void 0;
exports.MAX_TRACK_DURATION_MS = 24 * 60 * 60 * 1000;
const playtimeSum = (duration, plays) => ({
    $sum: { $cond: [{ $and: [{ $gt: [duration, 0] }, { $lte: [duration, exports.MAX_TRACK_DURATION_MS] }] }, { $multiply: [duration, plays] }, 0] },
});
exports.playtimeSum = playtimeSum;
