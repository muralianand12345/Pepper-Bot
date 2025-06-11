"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wait = exports.sendTempMessage = void 0;
const promises_1 = __importDefault(require("timers/promises"));
const sendTempMessage = async (channel, embed, duration = 10000) => {
    if (!channel.isTextBased())
        throw new Error("Channel is not text-based");
    const message = await channel.send({ embeds: [embed] }).catch((error) => {
        if (error.code === 50001)
            return null;
        return null;
    });
    if (!message)
        return;
    setTimeout(() => {
        message.delete().catch((deleteError) => {
            if (deleteError.code !== 10008) { }
        });
    }, duration);
};
exports.sendTempMessage = sendTempMessage;
const wait = async (ms) => {
    await promises_1.default.setTimeout(ms);
};
exports.wait = wait;
