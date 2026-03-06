import type { z } from "zod";
import { emptySchema } from "./schemas";
import type { ActionDef } from "./types";

export const inventory: ActionDef<z.infer<typeof emptySchema>> = {
	schema: emptySchema,
	description:
		"inventory(): Check what the player is carrying. No parameters. Shorthand: i. Use for queries like 'what am I carrying?'.",
	handler: (event, state, world) => {
		if (state.player.state.dead) {
			event.stop("You have no possessions.");
			return state;
		}
		if (state.player.inventory.length === 0) {
			event.stop("You aren't carrying anything.");
			return state;
		}
		const names = state.player.inventory.map((id) => world.objects[id]?.name ?? id);
		return { state, feedback: [`You are carrying: ${names.join(", ")}.`] };
	},
};
