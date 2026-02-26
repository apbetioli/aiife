import { z } from "zod";
import type { ActionDefinition } from "../ActionRegistry";
import { getInventoryItems } from "../ActionValidator";

export const inventoryAction: ActionDefinition = {
	name: "inventory",
	description: "Check what the player is carrying",
	helpText: "**inventory** (i) -- Check what you're carrying",
	inputSchema: z.object({}),
	parsePatterns: [{ pattern: /^(inventory|i|inv)$/, extract: () => ({}) }],
	handler(_params, state) {
		const items = getInventoryItems(state);
		if (items.length === 0) {
			return { message: "You are empty-handed.", success: true };
		}
		const list = items.map((i) => `  - ${i.name}`).join("\n");
		return { message: `You are carrying:\n${list}`, success: true };
	},
};
