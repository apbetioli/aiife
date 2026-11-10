import type { z } from "zod";
import { resolveTarget } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const use: ActionDef<z.infer<typeof objectsSchema>> = {
	inputSchema: objectsSchema,
	description:
		"use(objects): Use an object, optionally on a target. objects: [item_id] or [item_id, target_id] (e.g. 'use key on door' → [key, door]).",
	scope: (ctx) => ctx.in_scope_objects.length > 0,
	execute: (params, { state, world, stop }) => {
		const target = resolveTarget(params, state, world);
		if (!target) {
			stop();
			return "Use what?";
		}
		stop();
		return `You can't figure out how to use the ${target.obj.name}.`;
	},
};
