import type { z } from "zod";
import {
	findOpenContainerInRoom,
	isInInventory,
	isInRoom,
	moveObjectFromContainerToInventory,
	moveObjectFromRoomToInventory,
} from "../../mutators";
import { getObjectIds } from "./helpers";
import { objectsSchema } from "./schemas";
import type { ActionDef } from "./types";

export const take: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	aliases: ["pick up", "get", "grab", "collect"],
	description:
		'take(objects): Pick up objects from the current room. For "take all", list every visible carriable object id. For "take X and Y", list [X, Y]. For single "take X", list [X].',
	handler: (event, state, _world) => {
		const ids = getObjectIds(event.params);
		if (ids.length === 0) {
			event.stop();
			return "Take what?";
		}
		if (state.player.state.dead) {
			event.stop();
			return "Your hand passes through its object.";
		}
		const canTake = (id: string) => state.objects[id]?.state.carriable !== false && !isInInventory(state, id);
		const fromRoom = ids.filter((id) => isInRoom(state, id) && canTake(id));
		const fromContainer: { id: string; containerId: string }[] = [];
		for (const id of ids) {
			if (fromRoom.includes(id)) continue;
			if (!canTake(id)) continue;
			const cid = findOpenContainerInRoom(state, id);
			if (cid) fromContainer.push({ id, containerId: cid });
		}
		if (fromRoom.length === 0 && fromContainer.length === 0) {
			event.stop();
			return ids.some((id) => isInInventory(state, id)) ? "You're already carrying that." : "You can't take that.";
		}
		for (const id of fromRoom) {
			moveObjectFromRoomToInventory(state, id);
		}
		for (const { id, containerId } of fromContainer) {
			moveObjectFromContainerToInventory(state, id, containerId);
		}
	},
};
