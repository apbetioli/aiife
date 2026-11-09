import type { z } from "zod";
import { findOpenContainerInRoom, isInInventory, isInRoom, moveObject } from "../../../mutators";
import { getObjectIds } from "../helpers";
import { objectsWithPrepositionSchema } from "../schemas";
import type { ActionDef } from "../types";

export const put: ActionDef<z.infer<typeof objectsWithPrepositionSchema>> = {
	schema: objectsWithPrepositionSchema,
	aliases: ["insert", "place"],
	description:
		'put(objects, preposition?): Put an item into a container or onto the floor. objects: [item_id, container_id_or_floor], preposition: "in" | "into" | "on". Use "floor" or "ground" as the second object to put something on the floor.',
	hint: 'Use "floor" or "ground" as the second object to put something on the floor.',
	scope: (ctx) => ctx.in_scope_objects.some((o) => o.source === "inventory"),
	execute: (params, { state, world, stop }) => {
		if (state.player.state.dead) {
			stop();
			return "Your hand passes through its object.";
		}

		const ids = getObjectIds(params);
		if (ids.length < 2) {
			stop();
			return ids.length === 0 ? "Put what?" : "Where do you want to put it?";
		}

		const itemId = ids[0];
		const targetId = ids[1];

		const item = world.objects[itemId];
		const itemState = state.objects[itemId];

		if (!item || !itemState) {
			stop();
			return "You don't see that here.";
		}

		// Handle putting on floor / ground / current room
		const isFloorTarget = targetId === "floor" || targetId === "ground" || targetId === state.player.current_room;
		if (isFloorTarget) {
			if (itemState.location === state.player.current_room) {
				stop();
				return `The ${item.name} is already on the floor.`;
			}
			if (itemState.state.carriable === false && !isInInventory(state, itemId)) {
				stop();
				return `The ${item.name} cannot be moved.`;
			}
			if (!isInInventory(state, itemId) && !isInRoom(state, itemId) && !findOpenContainerInRoom(state, itemId)) {
				stop();
				return `You don't have the ${item.name}.`;
			}

			moveObject(state, itemId, state.player.current_room);
			return `You put the ${item.name} on the floor.`;
		}

		const container = world.objects[targetId];
		const containerState = state.objects[targetId];

		if (!container || !containerState) {
			stop();
			return "You don't see that container here.";
		}
		if (container.type !== "container") {
			stop();
			return `The ${container.name} is not a container.`;
		}
		if (containerState.state.open === false) {
			stop();
			return `The ${container.name} is closed.`;
		}
		if (itemId === targetId) {
			stop();
			return "You can't put something inside itself.";
		}

		// Prevent moving into a container that is nested inside the item itself
		let curr: string | undefined = targetId;
		while (curr && curr !== "inventory" && state.objects[curr]) {
			if (curr === itemId) {
				stop();
				return "You can't put something inside one of its contents.";
			}
			curr = state.objects[curr].location;
		}

		if (itemState.location === targetId) {
			stop();
			return `The ${item.name} is already in the ${container.name}.`;
		}

		if (itemState.state.carriable === false && !isInInventory(state, itemId)) {
			stop();
			return `The ${item.name} cannot be moved.`;
		}

		if (!isInInventory(state, itemId) && !isInRoom(state, itemId) && !findOpenContainerInRoom(state, itemId)) {
			stop();
			return `You don't have the ${item.name}.`;
		}

		moveObject(state, itemId, targetId);
		return `You put the ${item.name} into the ${container.name}.`;
	},
};
