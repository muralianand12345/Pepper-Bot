import { Events } from "discord.js";

import { BotEvent, IUserPremium, IPremiumData, IRedeemCode } from "../../../types";

import premiumUserModal from "../../database/schema/userPremium";
import premiumRedeemModal from "../../database/schema/redeemCode";

import { schedule } from "node-cron";

const event: BotEvent = {
    name: Events.ClientReady,
    execute: async (client) => {

        schedule('*/60 * * * * *', async () => {
            await premiumUserModal.find({ isPremium: true }, async (err: Error | any, users: IUserPremium[]) => {
                if (users && users.length) {
                    for (let user of users) {
                        if (Date.now() >= user.premium.expiresAt) {
                            user.isPremium = false;
                            const user_premium = user.premium as IPremiumData;
                            user_premium.redeemedBy = null;
                            user_premium.redeemedAt = null;
                            user_premium.expiresAt = null;
                            user_premium.plan = null;
                            await user.save();
                            client.logger.info(`Premium for ${user.userId} has expired`);
                        }
                    }
                }
            });
        });

        schedule('*/60 * * * * *', async () => {
            await premiumRedeemModal.find({}, async (err: Error | any, codes: IRedeemCode[]) => {
                if (codes && codes.length) {
                    for (let code of codes) {
                        if (Date.now() >= code.expiresAt) {
                            await code.deleteOne();
                            client.logger.info(`Redeem code ${code.code} has expired`);
                        }
                    }
                }
            });
        });
    }
}

export default event;