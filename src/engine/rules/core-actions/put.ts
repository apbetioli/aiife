import type { z } from "zod";
import { findOpenContainerInRoom, isInInventory, isInRoom, moveObject } from "../../mutators";
import { getObjectIds } from "./helpers";
import { objectsWithPrepositionSchema } from "./schemas";
import type { ActionDef } from "./types";

export const put: ActionDef<z.infer<typeof objectsWithPrepositionSchema>> = {
	schema: objectsWithPrepositionSchema,
	aliases: ["insert", "place"],
	description:
		"put(objects, preposition?): Put an item into a container. objects: [item_id, container_id], preposition: 'in' | 'into' | 'on'.",
	handler: (event, state, world) => {
		if (state.player.state.dead) {
			event.stop();
			return "Your hand passes through its object.";
		}

		const ids = getObjectIds(event.params);
		if (ids.length < 2) {
			event.stop();
			return ids.length === 0 ? "Put what?" : "Where do you want to put it?";
		}

		const itemId = ids[0];
		const containerId = ids[1];

		const item = world.objects[itemId];
		const itemState = state.objects[itemId];
		const container = world.objects[containerId];
		const containerState = state.objects[containerId];

		if (!item || !itemState) {
			event.stop();
			return "You don't see that here.";
		}
		if (!container || !containerState) {
			event.stop();
			return "You don't see that container here.";
		}
		if (container.type !== "container") {
			event.stop();
			return `The ${container.name} is not a container.`;
		}
		if (containerState.state.open === false) {
			event.stop();
			return `The ${container.name} is closed.`;
		}
		if (itemId === containerId) {
			event.stop();
			return "You can't put something inside itself.";
		}

		// Prevent moving into a container that is nested inside the item itself
		let curr: string | undefined = containerId;
		while (curr && curr !== "inventory" && state.objects[curr]) {
			if (curr === itemId) {
				event.stop();
				return "You can't put something inside one of its contents.";
			}
			curr = state.objects[curr].location;
		}

		if (itemState.location === containerId) {
			event.stop();
			return `The ${item.name} is already in the ${container.name}.`;
		}

		if (itemState.state.carriable === false && !isInInventory(state, itemId)) {
			event.stop();
			return `The ${item.name} cannot be moved.`;
		}

		if (!isInInventory(state, itemId) && !isInRoom(state, itemId) && !findOpenContainerInRoom(state, itemId)) {
			event.stop();
			return `You don't have the ${item.name}.`;
		}

		moveObject(state, itemId, containerId);
		return `You put the ${item.name} into the ${container.name}.`;
	},
};
