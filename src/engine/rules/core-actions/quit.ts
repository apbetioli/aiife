import { z } from "zod";
import { setPlayerState } from "../../mutators";
import type { ActionDef } from "./types";
import { emptySchema } from "./schemas";

export const quit: ActionDef<z.infer<typeof emptySchema>> = {
	schema: emptySchema,
	description: "quit(): End the game. Shorthand: q.",
	handler: (_event, state, _world) => ({
		state: setPlayerState(state, "quit", true),
		feedback: ["Goodbye!"],
	}),
};
