import type { z } from "zod";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const diagnose: ActionDef<z.infer<typeof emptySchema>> = {
	inputSchema: emptySchema,
	aliases: ["health", "status"],
	description: "diagnose(): Report the player's physical condition and health.",
	execute: (_params, { state }) => {
		if (state.player.state.dead) {
			return "You are dead.";
		}
		if (state.player.state.staggered) {
			return "You have been wounded, but are still capable of fighting.";
		}
		return "You are in perfect health.";
	},
};
