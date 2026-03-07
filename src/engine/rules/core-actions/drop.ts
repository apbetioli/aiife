import type { z } from "zod";
import { isInInventory, moveObjectFromInventoryToRoom } from "../../mutators";
import { getObjectIds } from "./helpers";
import { objectsSchema } from "./schemas";
import type { ActionDef } from "./types";

export const drop: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description:
		'drop(objects): Drop objects from inventory. For "drop all", list every inventory object id. For "drop all but X", list every inventory object id except X. For "drop X and Y", list [X, Y]. For single "drop X", list [X].',
	handler: (event, state) => {
		const ids = getObjectIds(event.params);
		const toDrop = ids.filter((id) => isInInventory(state, id));
		if (toDrop.length === 0) {
			event.stop();
			return ids.length === 0 ? "Drop what?" : "You're not carrying any of those.";
		}
		const roomId = state.player.current_room;
		for (const id of toDrop) {
			moveObjectFromInventoryToRoom(state, id, roomId);
		}
	},
};
