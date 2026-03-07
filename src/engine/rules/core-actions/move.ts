import type { z } from "zod";
import { resolveTarget } from "./helpers";
import { objectsWithDirectionSchema } from "./schemas";
import type { ActionDef } from "./types";

export const move: ActionDef<z.infer<typeof objectsWithDirectionSchema>> = {
	schema: objectsWithDirectionSchema,
	description: "move(objects, direction?): Move an object. objects: [target_id]. direction is optional.",
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world, {
			presence: "inRoom",
		});
		if (!target) {
			event.stop();
			return "Move what?";
		}
		event.stop();
		return `You can't move the ${target.obj.name}.`;
	},
};
