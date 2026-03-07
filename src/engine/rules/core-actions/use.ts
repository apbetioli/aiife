import type { z } from "zod";
import { resolveTarget } from "./helpers";
import { objectsSchema } from "./schemas";
import type { ActionDef } from "./types";

export const use: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description:
		"use(objects): Use an object, optionally on a target. objects: [item_id] or [item_id, target_id] (e.g. 'use key on door' → [key, door]).",
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world);
		if (!target) {
			event.stop();
			return "Use what?";
		}
		event.stop();
		return `You can't figure out how to use the ${target.obj.name}.`;
	},
};
