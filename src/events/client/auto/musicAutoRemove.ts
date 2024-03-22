import { Events } from "discord.js";

import { BotEvent } from "../../../types";

import premiumUserModal from "../../database/schema/userPremium";
import premiumRedeemModal from "../../database/schema/redeemCode";

import { schedule } from "node-cron";

const event: BotEvent = {
    name: Events.ClientReady,
    execute: async (client) => {

        schedule('*/60 * * * * *', async () => {
            await premiumUserModal.find({ isPremium: true }, async (err: any, users: any) => {
                if (users && users.length) {
                    for (let user of users) {
                        if (Date.now() >= user.premium.expiresAt) {
                            user.isPremium = false;
                            user.premium.redeemedBy = null;
                            user.premium.redeemedAt = null;
                            user.premium.expiresAt = null;
                            user.premium.plan = null;
                            await user.save();
                            client.logger.info(`Premium for ${user.userId} has expired`);
                        }
                    }
                }
            });
        });

        schedule('*/60 * * * * *', async () => {
            await premiumRedeemModal.find({}, async (err: any, codes: any) => {
                if (codes && codes.length) {
                    for (let code of codes) {
                        if (Date.now() >= code.expiresAt) {
                            await code.delete();
                            client.logger.info(`Redeem code ${code.code} has expired`);
                        }
                    }
                }
            });
        });
    }
}

export default event;