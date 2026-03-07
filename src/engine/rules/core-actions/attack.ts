import type { z } from "zod";
import { resolveTarget } from "./helpers";
import { objectsSchema } from "./schemas";
import type { ActionDef } from "./types";

export const attack: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description: "attack(objects): Attack something. objects: [target_id] or [target_id, weapon_id].",
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world);
		if (!target) {
			event.stop();
			return "Attack what?";
		}
		event.stop();
		return `Attacking the ${target.obj.name} has no effect.`;
	},
};
