import { z } from "zod";
import type { ActionDef } from "./types";
import { resolveTarget } from "./types";
import { objectsSchema } from "./schemas";

export const use: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description:
		"use(objects): Use an object, optionally on a target. objects: [item_id] or [item_id, target_id] (e.g. 'use key on door' → [key, door]).",
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world, { missingMessage: "Use what?" });
		if (!target) return state;
		event.stop(`You can't figure out how to use the ${target.obj.name}.`);
		return state;
	},
};
