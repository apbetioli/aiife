import type { z } from "zod";
import { objectsSchema } from "./schemas";
import { resolveTarget } from "./helpers";
import type { ActionDef } from "./types";

export const attack: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description: "attack(objects): Attack something. objects: [target_id] or [target_id, weapon_id].",
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world, { missingMessage: "Attack what?" });
		if (!target) return state;
		event.stop(`Attacking the ${target.obj.name} has no effect.`);
		return state;
	},
};
