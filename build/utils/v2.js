"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.v2Webhook = exports.fields = exports.panel = exports.subtext = exports.withRows = exports.v2Text = exports.v2Ephemeral = exports.v2 = void 0;
const discord_js_1 = __importDefault(require("discord.js"));
const flatten = (inputs) => inputs.flat().filter((component) => Boolean(component));
const v2 = (...components) => ({ components: flatten(components), flags: discord_js_1.default.MessageFlags.IsComponentsV2 });
exports.v2 = v2;
const v2Ephemeral = (...components) => ({ components: flatten(components), flags: [discord_js_1.default.MessageFlags.IsComponentsV2, discord_js_1.default.MessageFlags.Ephemeral] });
exports.v2Ephemeral = v2Ephemeral;
const v2Text = (content) => new discord_js_1.default.TextDisplayBuilder().setContent(content);
exports.v2Text = v2Text;
const withRows = (container, ...rows) => {
    const present = rows.filter((row) => Boolean(row));
    if (present.length === 0)
        return container;
    container.addSeparatorComponents(new discord_js_1.default.SeparatorBuilder().setDivider(false).setSpacing(discord_js_1.default.SeparatorSpacingSize.Small));
    present.forEach((row) => container.addActionRowComponents(row));
    return container;
};
exports.withRows = withRows;
const subtext = (text) => `-# ${text}`;
exports.subtext = subtext;
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
const fields = (entries) => entries
    .filter((entry) => Boolean(entry))
    .map(([label, value]) => `**${label}:** ${value}`)
    .join('\n');
exports.fields = fields;
const v2Webhook = (...components) => ({ ...(0, exports.v2)(...components), withComponents: true });
exports.v2Webhook = v2Webhook;
