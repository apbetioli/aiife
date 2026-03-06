import { z } from "zod";
import type { ActionDef } from "./types";
import { resolveTarget } from "./types";
import { objectsSchema } from "./schemas";

export const talk: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description: "talk(objects): Talk to an actor in the current room. objects: [actor_id].",
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world, {
			missingMessage: "Talk to whom?",
			notHereMessage: "You don't see anyone by that name here.",
		});
		if (!target) return state;
		event.stop(`${target.obj.name} doesn't seem interested in talking.`);
		return state;
	},
};
