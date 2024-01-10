const {
    EmbedBuilder
} = require("discord.js");

const voucher_codes = require('voucher-code-generator');

const musicPremiumModal = require("../../events/database/modals/redeemCode.js");

module.exports = {
    name: "generate",
    description: "Generate a premium code",
    cooldown: 1000,
    owner: true,
    userPerms: ['Administrator'],
    botPerms: ['Administrator'],
    async execute(client, message, args) {
        var plan = args[0];
        var amount = parseInt(args[1]);
        let codes = [];
        const plans = ['daily', 'weekly', 'monthly', 'yearly', 'lifetime'];

        if (!plans.includes(plan)) return message.channel.send("Please provide a valid plan!");

        if (!amount) amount = 1;
        if (amount > 10) return message.channel.send("You can only generate 10 codes at a time!");

        for (let i = 0; i < amount; i++) {
            // Move the expiration time calculation inside the loop
            let time;
            if (plan === 'daily') time = Date.now() + 86400000;
            if (plan === 'weekly') time = Date.now() + 86400000 * 7;
            if (plan === 'monthly') time = Date.now() + 86400000 * 30;
            if (plan === 'yearly') time = Date.now() + 86400000 * 365;
            if (plan === 'lifetime') time = Date.now() + 86400000 * 365 * 100;

            const codePremium = voucher_codes.generate({
                pattern: "####-####-####",
            });

            const code = codePremium.toString().toUpperCase();

            const find = await musicPremiumModal.findOne({
                code: code
            });

            if (!find) {
                const create = new musicPremiumModal({
                    code: code,
                    expiresAt: time,
                    plan: plan
                });
                create.save();
                codes.push(`${i + 1} - ${code}`);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle("Premium Codes Generated")
            .setDescription(`**Plan:** ${plan}\n**Amount:** ${amount}\n**Codes:**\n${codes.join("\n")}`)
            .setColor("#00FF00")
            .setFooter({ text: message.author.tag, iconURL: message.author.avatarURL() })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });

        await message.delete();
    }
}
