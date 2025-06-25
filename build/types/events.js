"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMAND_CATEGORY_MAP = exports.CommandCategory = void 0;
var CommandCategory;
(function (CommandCategory) {
    CommandCategory["UTILITY"] = "utility";
    CommandCategory["MUSIC"] = "music";
    CommandCategory["OTHER"] = "other";
})(CommandCategory || (exports.CommandCategory = CommandCategory = {}));
exports.COMMAND_CATEGORY_MAP = {
    [CommandCategory.MUSIC]: {
        emoji: '🎵',
        name: 'Music Commands',
    },
    [CommandCategory.UTILITY]: {
        emoji: '🔧',
        name: 'Utility Commands',
    },
    [CommandCategory.OTHER]: {
        emoji: '📦',
        name: 'Other Commands',
    },
};
