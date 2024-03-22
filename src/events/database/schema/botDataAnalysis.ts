import { Schema, model } from "mongoose";
import { IBotDataAnalysis } from "../../../types";

const botDataAnalysisSchema = new Schema<IBotDataAnalysis>({
    clientId: { type: String, required: true },
    restartCount: { type: Number, required: true },
    interactionCount: { type: Number, required: false },
    commandCount: { type: Number, required: false },
    server: [{
        serverId: { type: String, required: true },
        serverName: { type: String, required: true },
        serverOwner: { type: String, required: false },
        serverMemberCount: { type: Number, required: false },
        timeOfJoin: { type: Date, required: false },
        active: { type: Boolean, default: true, required: true }
    }]
});

export default model('bot-data', botDataAnalysisSchema);