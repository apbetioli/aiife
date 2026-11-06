import type { z } from "zod";
import { getInventory } from "../../../mutators";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const inventory: ActionDef<z.infer<typeof emptySchema>> = {
	schema: emptySchema,
	aliases: ["i"],
	description:
		"inventory(): Check what the player is carrying. No parameters. Shorthand: i. Use for queries like 'what am I carrying?'.",
	handler: (event, state, world) => {
		if (state.player.state.dead) {
			event.stop();
			return "You have no possessions.";
		}
		const items = getInventory(state);
		if (items.length === 0) {
			event.stop();
			return "You aren't carrying anything.";
		}
		const names = items.map((id) => world.objects[id]?.name ?? id);
		return `You are carrying: ${names.join(", ")}.`;
	},
};
