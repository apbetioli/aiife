import type { z } from "zod";
import { resolveTarget } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const talk: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	aliases: ["speak", "speak to", "speak with", "ask", "chat"],
	description: "talk(objects): Talk to an actor in the current room. objects: [actor_id].",
	scope: (ctx) => ctx.in_scope_objects.some((o) => o.type === "actor"),
	execute: (params, { state, world, stop }) => {
		const target = resolveTarget(params, state, world);
		if (!target) {
			stop();
			return "Talk to whom?";
		}
		stop();
		return `${target.obj.name} doesn't seem interested in talking.`;
	},
};
