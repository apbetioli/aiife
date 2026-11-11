import type { z } from "zod";
import { getInventory, moveObject, setPlayerState } from "../../../mutators";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const die: ActionDef<z.infer<typeof emptySchema>> = {
	inputSchema: emptySchema,
	description: "",
	execute: (_params, { state, stop }) => {
		stop();
		setPlayerState(state, "dead", true);
		for (const id of getInventory(state)) {
			moveObject(state, id, state.player.current_room);
		}
		return "You died!";
	},
};
