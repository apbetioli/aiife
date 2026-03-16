import type { z } from "zod";
import { resolveTarget } from "./helpers";
import { objectsSchema } from "./schemas";
import type { ActionDef } from "./types";

export const talk: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	aliases: ["speak", "speak to", "speak with", "ask", "chat"],
	description: "talk(objects): Talk to an actor in the current room. objects: [actor_id].",
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world);
		if (!target) {
			event.stop();
			return "Talk to whom?";
		}
		event.stop();
		return `${target.obj.name} doesn't seem interested in talking.`;
	},
};
