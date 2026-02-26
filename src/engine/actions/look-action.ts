import { z } from "zod";
import type { ActionDefinition } from "../ActionRegistry";
import {
	getCurrentRoom,
	getRoomNPCs,
	getVisibleItems,
} from "../ActionValidator";

export const lookAction: ActionDefinition = {
	name: "look",
	description: "Look around the current room",
	helpText: "**look** (l) -- Describe your surroundings",
	inputSchema: z.object({}),
	parsePatterns: [{ pattern: /^(look|l)$/, extract: () => ({}) }],
	handler(_params, state) {
		const room = getCurrentRoom(state);
		const items = getVisibleItems(state);
		const npcs = getRoomNPCs(state);
		const exits = room.exits.map((e) => {
			let label = e.direction;
			if (e.locked) label += " (locked)";
			return label;
		});

		let message = `\n**${room.name}**\n${room.description}`;
		if (items.length > 0) {
			message += `\n\nYou can see: ${items.map((i) => i.name).join(", ")}.`;
		}
		if (npcs.length > 0) {
			message += `\n\n${npcs
				.map((n) => `There is a ${n.name} here.`)
				.join(" ")}`;
		}
		message += `\n\nExits: ${exits.join(", ")}.`;
		return { message, success: true };
	},
};
