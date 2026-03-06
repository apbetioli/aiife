import type { z } from "zod";
import {
	findOpenContainerInRoom,
	isInInventory,
	isInRoom,
	moveObjectFromContainerToInventory,
	moveObjectFromRoomToInventory,
} from "../../mutators";
import { objectsSchema } from "./schemas";
import { getObjectIds } from "./helpers";
import type { ActionDef } from "./types";

export const take: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description:
		'take(objects): Pick up objects from the current room. For "take all", list every visible carriable object id. For "take X and Y", list [X, Y]. For single "take X", list [X].',
	handler: (event, state, _world) => {
		const ids = getObjectIds(event.params);
		if (ids.length === 0) {
			event.stop("Take what?");
			return state;
		}
		if (state.player.state.dead) {
			event.stop("Your hand passes through its object.");
			return state;
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
			if (ids.some((id) => isInInventory(state, id))) {
				event.stop("You're already carrying that.");
				return state;
			}
			event.stop("You can't take that.");
			return state;
		}
		let nextState = state;
		for (const id of fromRoom) {
			nextState = moveObjectFromRoomToInventory(nextState, id);
		}
		for (const { id, containerId } of fromContainer) {
			nextState = moveObjectFromContainerToInventory(nextState, id, containerId);
		}
		return { state: nextState };
	},
};
