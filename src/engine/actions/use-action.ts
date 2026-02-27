import { z } from "zod";
import type { ActionDefinition } from "../ActionRegistry";
import { isItemInInventory, resolveItem } from "../ActionValidator";

export const useAction: ActionDefinition = {
	name: "use",
	description:
		"use(items, target?): Use an item, optionally on a target. items is an array with the item name. target is the optional name of what to use it on.",
	helpText: "**use <item>** / **use <item> on <target>** -- Use an item",
	inputSchema: z.object({
		items: z.array(z.string()).min(1).describe("Names of items to use"),
		target: z
			.string()
			.optional()
			.describe("Optional target to use the items on"),
	}),
	parsePatterns: [
		{
			pattern: /^use\s+(.+?)\s+on\s+(.+)$/,
			extract: (m) => ({ items: [m[1].trim()], target: m[2].trim() }),
		},
		{
			pattern: /^use\s+(.+)$/,
			extract: (m) => ({ items: [m[1].trim()] }),
		},
	],
	handler(params, state) {
		const items = params.items as string[] | undefined;
		const itemName = items?.[0];
		if (!itemName) {
			return { success: false, message: "What do you want to use?" };
		}

		const item = resolveItem(itemName, state);
		if (!item) {
			return {
				success: false,
				message: `You don't have any "${itemName}".`,
			};
		}
		if (!isItemInInventory(item.id, state)) {
			return {
				success: false,
				message: `You need to pick up the ${item.name} first.`,
			};
		}

		const targetName = params.target as string | undefined;
		return {
			message: `You're not sure how to use the ${item.name}${
				targetName ? ` on the ${targetName}` : ""
			} here.`,
			success: false,
		};
	},
};
