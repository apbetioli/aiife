import { z } from "zod";
import type { ActionDefinition } from "../ActionRegistry";
import { resolveItem, resolveNPC } from "../ActionValidator";

export const examineAction: ActionDefinition = {
	name: "examine",
	description: "Look closely at an item, NPC, or feature in the current room",
	helpText: "**examine <thing>** (x) -- Look closely at something",
	inputSchema: z.object({
		target: z.string().describe("What to examine"),
	}),
	parsePatterns: [
		{
			pattern: /^(?:examine|ex|x)\s+(.+)$/,
			extract: (m) => ({ target: m[1].trim() }),
		},
		{
			pattern: /^look\s+at\s+(.+)$/,
			extract: (m) => ({ target: m[1].trim() }),
		},
	],
	handler(params, state) {
		const target = params.target as string | undefined;
		if (!target) {
			return { success: false, message: "What do you want to examine?" };
		}

		const item = resolveItem(target, state);
		if (item) return { message: item.description, success: true };

		const npc = resolveNPC(target, state);
		if (npc) return { message: npc.description, success: true };

		return {
			message: `You don't see any "${target}" here.`,
			success: false,
		};
	},
};
