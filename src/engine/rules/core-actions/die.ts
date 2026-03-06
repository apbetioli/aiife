import { z } from "zod";
import { setPlayerState } from "../../mutators";
import type { ActionDef } from "./types";
import { emptySchema } from "./schemas";

export const die: ActionDef<z.infer<typeof emptySchema>> = {
	schema: emptySchema,
	description: "",
	handler: (event, state, _world) => {
		event.stop("You died!");
		return { state: setPlayerState(state, "dead", true) };
	},
};
