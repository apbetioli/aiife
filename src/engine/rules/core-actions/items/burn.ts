import type { z } from "zod";
import { resolveTarget } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const burn: ActionDef<z.infer<typeof objectsSchema>> = {
	inputSchema: objectsSchema,
	aliases: ["ignite", "set fire to", "light with"],
	description: "burn(objects): Burn or ignite an object. objects: [target_id].",
	execute: (params, { state, world, stop }) => {
		const target = resolveTarget(params, state, world);
		if (!target) {
			stop();
			return "Burn what?";
		}
		stop();
		return "You can't burn that.";
	},
};
