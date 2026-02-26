import { z } from "zod";
import type { ActionDefinition } from "../ActionRegistry";
import { getCurrentRoom, resolveItem } from "../ActionValidator";

export const openAction: ActionDefinition = {
	name: "open",
	description: "open(target): Open a container or door. target is the name of what to open.",
	helpText: "**open <thing>** -- Open something",
	inputSchema: z.object({
		target: z.string().describe("What to open"),
	}),
	parsePatterns: [
		{
			pattern: /^open\s+(.+)$/,
			extract: (m) => ({ target: m[1].trim() }),
		},
	],
	handler(params, state) {
		const target = params.target as string | undefined;
		if (!target) {
			return { success: false, message: "What do you want to open?" };
		}

		const room = getCurrentRoom(state);
		const lockedExit = room.exits.find((e) =>
			e.description?.toLowerCase().includes(target.toLowerCase()),
		);
		if (lockedExit) {
			if (!lockedExit.locked) {
				return { success: false, message: "It's already open." };
			}
			return {
				success: false,
				message: lockedExit.description ?? "That way is locked.",
			};
		}

		const item = resolveItem(target, state);
		if (!item) {
			return {
				success: false,
				message: `You don't see any "${target}" to open.`,
			};
		}
		if (!item.traits.includes("openable")) {
			return {
				success: false,
				message: `You can't open the ${item.name}.`,
			};
		}

		return {
			success: false,
			message: `You can't open the ${item.name}.`,
		};
	},
};
