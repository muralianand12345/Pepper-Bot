import discord from 'discord.js';
import { ManagerEventTypes } from 'magmastream';

import { LavalinkEvent } from '../../../../types';

const lavalinkEvent: LavalinkEvent = {
	name: ManagerEventTypes.Debug,
	execute: async (info: string, client: discord.Client) => client.logger.debug(`[LAVALINK] ${info}`),
};

export default lavalinkEvent;
