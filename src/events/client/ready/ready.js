const {
    EmbedBuilder,
    Events
} = require('discord.js');

const botAnalysis = require('../../database/modals/botDataAnalysis.js');

module.exports = {
    name: Events.ClientReady,
    async execute(client) {

        var botAnalysisData = await botAnalysis.findOne({
            clientId: client.user.id
        });

        if (!botAnalysisData) {
            botAnalysisData = new botAnalysis({
                clientId: client.user.id,
                restartCount: 0,
                interactionCount: 0,
                commandCount: 0
            });
            await botAnalysisData.save();
        }

        botAnalysisData.restartCount += 1;
        await botAnalysisData.save();

        client.logger.success(`"${client.user.tag}" is Online!`);
        const err_logchan = client.channels.cache.get(client.config.bot.stdchan);

        const embed = new EmbedBuilder()
            .setColor('Orange')
            .setTitle(`Bot Restart Completed and Online ❤️`)
            .setTimestamp();
        err_logchan.send({ embeds: [embed] });
    },
};