import type { z } from "zod";
import { resolveTarget } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const breakAction: ActionDef<z.infer<typeof objectsSchema>> = {
	inputSchema: objectsSchema,
	aliases: ["smash", "shatter", "destroy", "wreck", "crack"],
	description: "break(objects): Break, smash, or destroy an object. objects: [target_id].",
	execute: (params, { state, world, stop }) => {
		const target = resolveTarget(params, state, world);
		if (!target) {
			stop();
			return "Break what?";
		}
		stop();
		return "You can't break that.";
	},
};
