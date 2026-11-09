import type { z } from "zod";
import { resolveTarget } from "../helpers";
import { objectsWithDirectionSchema } from "../schemas";
import type { ActionDef } from "../types";

export const move: ActionDef<z.infer<typeof objectsWithDirectionSchema>> = {
	schema: objectsWithDirectionSchema,
	aliases: ["push", "pull", "shift", "drag"],
	description: "move(objects, direction?): Move an object. objects: [target_id]. direction is optional.",
	execute: (params, { state, world, stop }) => {
		const target = resolveTarget(params, state, world, {
			presence: "inRoom",
		});
		if (!target) {
			stop();
			return "Move what?";
		}
		stop();
		return `You can't move the ${target.obj.name}.`;
	},
};
