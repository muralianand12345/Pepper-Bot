import discord from 'discord.js';

/**
 * Components V2 helpers.
 *
 * A message sent with `MessageFlags.IsComponentsV2` may not carry `content`,
 * `embeds`, `poll` or `stickers` — every piece of the message is a component.
 * The flag also cannot be toggled off once a message has been created with it,
 * so a surface must be migrated as a whole: create *and* every later edit.
 */

/** Any component discord.js accepts at the top level of a message payload. */
export type V2Component = NonNullable<discord.BaseMessageOptions['components']>[number];

type V2Input = V2Component | readonly V2Component[] | null | undefined;

const flatten = (inputs: readonly V2Input[]): V2Component[] => inputs.flat().filter((component): component is V2Component => Boolean(component));

/** Message payload for a Components V2 message. */
export const v2 = (...components: V2Input[]): { components: V2Component[]; flags: discord.MessageFlags.IsComponentsV2 } => ({ components: flatten(components), flags: discord.MessageFlags.IsComponentsV2 });

/** Components V2 payload for an ephemeral interaction reply. Not valid on edits — Discord ignores Ephemeral there. */
export const v2Ephemeral = (...components: V2Input[]): { components: V2Component[]; flags: [discord.MessageFlags.IsComponentsV2, discord.MessageFlags.Ephemeral] } => ({ components: flatten(components), flags: [discord.MessageFlags.IsComponentsV2, discord.MessageFlags.Ephemeral] });

/** Wraps plain markdown in a bare text display, for messages that were previously just `content`. */
export const v2Text = (content: string): discord.TextDisplayBuilder => new discord.TextDisplayBuilder().setContent(content);

/** Appends action rows inside a container, separated from the body above them. */
export const withRows = (container: discord.ContainerBuilder, ...rows: (discord.ActionRowBuilder<discord.ButtonBuilder> | null | undefined)[]): discord.ContainerBuilder => {
	const present = rows.filter((row): row is discord.ActionRowBuilder<discord.ButtonBuilder> => Boolean(row));
	if (present.length === 0) return container;
	container.addSeparatorComponents(new discord.SeparatorBuilder().setDivider(false).setSpacing(discord.SeparatorSpacingSize.Small));
	present.forEach((row) => container.addActionRowComponents(row));
	return container;
};

/** Discord's subtext markdown — the closest equivalent to an embed footer. */
export const subtext = (text: string): string => `-# ${text}`;

/**
 * The Components V2 equivalent of a simple embed: an accent-coloured container with an
 * optional heading above a divider, a markdown body (beside a thumbnail when one is given)
 * and subtext standing in for the old footer/timestamp row.
 */
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

/** Renders what used to be inline embed fields as one stacked, labelled block. */
export const fields = (entries: ([string, string] | null | undefined)[]): string =>
	entries
		.filter((entry): entry is [string, string] => Boolean(entry))
		.map(([label, value]) => `**${label}:** ${value}`)
		.join('\n');

/**
 * Components V2 payload for a webhook send.
 *
 * Discord silently drops `components` from a webhook execute unless `with_components`
 * is set, which leaves a Components V2 payload with nothing in it and fails with
 * "Cannot send an empty message" (50006).
 */
export const v2Webhook = (...components: V2Input[]): { components: V2Component[]; flags: discord.MessageFlags.IsComponentsV2; withComponents: true } => ({ ...v2(...components), withComponents: true });
