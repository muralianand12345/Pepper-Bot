const {
    Events
} = require('discord.js');

const premiumUserModal = require('../../database/modals/userPremium.js');
const premiumRedeemModal = require('../../database/modals/redeemCode.js');

const cron = require('node-cron');

module.exports = {
    name: Events.ClientReady,
    async execute(client) {

        cron.schedule('*/60 * * * * *', async () => {
            await premiumUserModal.find({ isPremium: true }, async (err, users) => {
                if (users && users.length) {
                    for (let user of users) {
                        if (Date.now() >= user.premium.expiresAt) {
                            user.isPremium = false;
                            user.premium.redeemedBy = null;
                            user.premium.redeemedAt = null;
                            user.premium.expiresAt = null;
                            user.premium.plan = null;
                            await user.save();
                            client.logger.info(`Premium for ${user.userID} has expired`);
                        }
                    }
                }
            });
        });

        cron.schedule('*/60 * * * * *', async () => {
            await premiumRedeemModal.find({}, async (err, codes) => {
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