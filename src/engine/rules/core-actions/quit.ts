import type { z } from "zod";
import { setPlayerState } from "../../mutators";
import { emptySchema } from "./schemas";
import type { ActionDef } from "./types";

export const quit: ActionDef<z.infer<typeof emptySchema>> = {
	schema: emptySchema,
	description: "quit(): End the game. Shorthand: q.",
	handler: (_event, state, _world) => ({
		state: setPlayerState(state, "quit", true),
		feedback: ["Goodbye!"],
	}),
};
