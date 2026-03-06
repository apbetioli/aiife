import type { z } from "zod";
import { setPlayerState } from "../../mutators";
import { emptySchema } from "./schemas";
import type { ActionDef } from "./types";

export const die: ActionDef<z.infer<typeof emptySchema>> = {
	schema: emptySchema,
	description: "",
	handler: (event, state, _world) => {
		event.stop("You died!");
		return { state: setPlayerState(state, "dead", true) };
	},
};
