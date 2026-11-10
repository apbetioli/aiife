import type { z } from "zod";
import { setPlayerState } from "../../../mutators";
import { runAction } from "../helpers";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const die: ActionDef<z.infer<typeof emptySchema>> = {
	inputSchema: emptySchema,
	description: "",
	execute: (_params, { state, world, bus, stop }) => {
		stop();
		setPlayerState(state, "dead", true);
		runAction(bus, world, state, "drop", { objects: ["all"] });
		return "You died!";
	},
};
