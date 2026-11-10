import type { z } from "zod";
import { setPlayerState } from "../../../mutators";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const quit: ActionDef<z.infer<typeof emptySchema>> = {
	inputSchema: emptySchema,
	aliases: ["q"],
	description: "quit(): End the game. Shorthand: q.",
	execute: (_params, { state }) => {
		setPlayerState(state, "quit", true);
		return "Goodbye!";
	},
};
