import discord from 'discord.js';

export type V2Component = NonNullable<discord.BaseMessageOptions['components']>[number];

type V2Input = V2Component | readonly V2Component[] | null | undefined;

const flatten = (inputs: readonly V2Input[]): V2Component[] => inputs.flat().filter((component): component is V2Component => Boolean(component));

export const v2 = (...components: V2Input[]): { components: V2Component[]; flags: discord.MessageFlags.IsComponentsV2 } => ({ components: flatten(components), flags: discord.MessageFlags.IsComponentsV2 });

export const v2Ephemeral = (...components: V2Input[]): { components: V2Component[]; flags: [discord.MessageFlags.IsComponentsV2, discord.MessageFlags.Ephemeral] } => ({ components: flatten(components), flags: [discord.MessageFlags.IsComponentsV2, discord.MessageFlags.Ephemeral] });

export const v2Text = (content: string): discord.TextDisplayBuilder => new discord.TextDisplayBuilder().setContent(content);

export const withRows = (container: discord.ContainerBuilder, ...rows: (discord.ActionRowBuilder<discord.ButtonBuilder> | null | undefined)[]): discord.ContainerBuilder => {
	const present = rows.filter((row): row is discord.ActionRowBuilder<discord.ButtonBuilder> => Boolean(row));
	if (present.length === 0) return container;
	container.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(false).setSpacing(discord.SeparatorSpacingSize.Small));
	present.forEach((row) => container.addActionRowComponents(row));
	return container;
};

export const subtext = (text: string): string => `-# ${text}`;

export const panel = (accent: number, parts: { title?: string; body?: string; thumbnail?: string | null; footer?: string; timestamp?: boolean }): discord.ContainerBuilder => {
	const container = new discord.ContainerBuilder().setAccentColor(accent);

	if (parts.title) {
		container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(`### ${parts.title}`));
		container.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(true).setSpacing(discord.SeparatorSpacingSize.Small));
	}

	const trailer: string[] = [];
	if (parts.footer) trailer.push(subtext(parts.footer));
	if (parts.timestamp) trailer.push(subtext(`<t:${Math.floor(Date.now() / 1000)}:f>`));

	const body = [parts.body, trailer.join('\n')].filter(Boolean).join('\n\n');
	if (!body) return container;

	if (parts.thumbnail) {
		container.addSectionComponents(new discord.SectionBuilder().addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(body)).setThumbnailAccessory(new discord.ThumbnailBuilder().setURL(parts.thumbnail)));
	} else {
		container.addTextDisplayComponents(new discord.TextDisplayBuilder().setContent(body));
	}

	return container;
};

export const fields = (entries: ([string, string] | null | undefined)[]): string =>
	entries
		.filter((entry): entry is [string, string] => Boolean(entry))
		.map(([label, value]) => `**${label}:** ${value}`)
		.join('\n');

export const v2Webhook = (...components: V2Input[]): { components: V2Component[]; flags: discord.MessageFlags.IsComponentsV2; withComponents: true } => ({ ...v2(...components), withComponents: true });
