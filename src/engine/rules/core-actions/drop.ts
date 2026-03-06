import { z } from "zod";
import { isInInventory, moveObjectFromInventoryToRoom } from "../../mutators";
import type { ActionDef } from "./types";
import { getObjectIds } from "./types";
import { objectsSchema } from "./schemas";

export const drop: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description:
		'drop(objects): Drop objects from inventory. For "drop all", list every inventory object id. For "drop all but X", list every inventory object id except X. For "drop X and Y", list [X, Y]. For single "drop X", list [X].',
	handler: (event, state, _world) => {
		const ids = getObjectIds(event.params);
		const toDrop = ids.filter((id) => isInInventory(state, id));
		if (toDrop.length === 0) {
			if (ids.length === 0) {
				event.stop("Drop what?");
				return state;
			}
			event.stop("You're not carrying any of those.");
			return state;
		}
		const roomId = state.player.current_room;
		let nextState = state;
		for (const id of toDrop) {
			nextState = moveObjectFromInventoryToRoom(nextState, id, roomId);
		}
		return { state: nextState };
	},
};
