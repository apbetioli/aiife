import type { z } from "zod";
import { objectsWithDirectionSchema } from "./schemas";
import type { ActionDef } from "./types";
import { resolveTarget } from "./types";

export const move: ActionDef<z.infer<typeof objectsWithDirectionSchema>> = {
	schema: objectsWithDirectionSchema,
	description: "move(objects, direction?): Move an object. objects: [target_id]. direction is optional.",
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world, { missingMessage: "Move what?", presence: "inRoom" });
		if (!target) return state;
		event.stop(`You can't move the ${target.obj.name}.`);
		return state;
	},
};
