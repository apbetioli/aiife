import type { z } from "zod";
import { resolveTarget } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const blow: ActionDef<z.infer<typeof objectsSchema>> = {
	inputSchema: objectsSchema,
	aliases: ["puff", "blow on", "blow out"],
	description: "blow(objects): Blow or blow out an object, e.g. 'blow leaves', 'blow out candle'. objects: [target_id].",
	execute: (params, { state, world, stop }) => {
		const target = resolveTarget(params, state, world);
		if (!target) {
			stop();
			return "Blow what?";
		}
		stop();
		return "You can't usefully blow that.";
	},
};
