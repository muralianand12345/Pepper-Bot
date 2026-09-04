"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.v2Webhook = exports.fields = exports.panel = exports.subtext = exports.withRows = exports.v2Text = exports.v2Ephemeral = exports.v2 = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const flatten = (inputs) => inputs.flat().filter((component) => Boolean(component));
/** Message payload for a Components V2 message. */
const v2 = (...components) => ({ components: flatten(components), flags: discord_js_1.default.MessageFlags.IsComponentsV2 });
exports.v2 = v2;
/** Components V2 payload for an ephemeral interaction reply. Not valid on edits — Discord ignores Ephemeral there. */
const v2Ephemeral = (...components) => ({ components: flatten(components), flags: [discord_js_1.default.MessageFlags.IsComponentsV2, discord_js_1.default.MessageFlags.Ephemeral] });
exports.v2Ephemeral = v2Ephemeral;
/** Wraps plain markdown in a bare text display, for messages that were previously just `content`. */
const v2Text = (content) => new discord_js_1.default.TextDisplayBuilder().setContent(content);
exports.v2Text = v2Text;
/** Appends action rows inside a container, separated from the body above them. */
const withRows = (container, ...rows) => {
    const present = rows.filter((row) => Boolean(row));
    if (present.length === 0)
        return container;
    container.addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(false).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
    present.forEach((row) => container.addActionRowComponents(row));
    return container;
};
exports.withRows = withRows;
/** Discord's subtext markdown — the closest equivalent to an embed footer. */
const subtext = (text) => `-# ${text}`;
exports.subtext = subtext;
/**
 * The Components V2 equivalent of a simple embed: an accent-coloured container with an
 * optional heading above a divider, a markdown body (beside a thumbnail when one is given)
 * and subtext standing in for the old footer/timestamp row.
 */
const panel = (accent, parts) => {
    const container = new discord_js_1.default.ContainerBuilder().setAccentColor(accent);
    if (parts.title) {
        container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(`### ${parts.title}`));
        container.addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(true).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
    }
    const trailer = [];
    if (parts.footer)
        trailer.push((0, exports.subtext)(parts.footer));
    if (parts.timestamp)
        trailer.push((0, exports.subtext)(`<t:${Math.floor(Date.now() / 1000)}:f>`));
    const body = [parts.body, trailer.join('\n')].filter(Boolean).join('\n\n');
    if (!body)
        return container;
    if (parts.thumbnail) {
        container.addSectionComponents(new discord_js_1.default.SectionBuilder().addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(body)).setThumbnailAccessory(new discord_js_1.default.ThumbnailBuilder().setURL(parts.thumbnail)));
    }
    else {
        container.addTextDisplayComponents(new discord_js_1.default.TextDisplayBuilder().setContent(body));
    }
    return container;
};
exports.panel = panel;
/** Renders what used to be inline embed fields as one stacked, labelled block. */
const fields = (entries) => entries
    .filter((entry) => Boolean(entry))
    .map(([label, value]) => `**${label}:** ${value}`)
    .join('\n');
exports.fields = fields;
/**
 * Components V2 payload for a webhook send.
 *
 * Discord silently drops `components` from a webhook execute unless `with_components`
 * is set, which leaves a Components V2 payload with nothing in it and fails with
 * "Cannot send an empty message" (50006).
 */
const v2Webhook = (...components) => ({ ...(0, exports.v2)(...components), withComponents: true });
exports.v2Webhook = v2Webhook;
