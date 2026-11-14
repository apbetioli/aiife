import type { z } from "zod";
import { findOpenContainerInRoom, isInInventory, isInRoom, moveObject } from "../../../mutators";
import { getObjectIds } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const take: ActionDef<z.infer<typeof objectsSchema>> = {
	inputSchema: objectsSchema,
	aliases: ["pick up", "get", "grab", "collect"],
	description:
		'take(objects): Pick up objects from the current room. For "take all", list every visible carriable object id. For "take X and Y", list [X, Y]. For single "take X", list [X].',
	scope: (ctx) => ctx.in_scope_objects.some((o) => o.source === "room" && o.state?.carriable !== false),
	execute: (params, { state, world, stop }) => {
		if (state.player.state.dead) {
			stop();
			return "Your hand passes through its object.";
		}
		const ids = getObjectIds(params);
		if (ids.length === 0) {
			stop();
			return "Take what?";
		}
		if (ids.length === 1) {
			const id = ids[0];
			if (isInInventory(state, id)) {
				stop();
				return "You're already carrying that.";
			}
			const obj = world.objects[id];
			if (state.objects[id]?.state.carriable === false) {
				stop();
				return obj?.descriptions.cant_take ?? "You can't take that.";
			}
			if (!isInRoom(state, id) && !findOpenContainerInRoom(state, id)) {
				stop();
				return "You can't take that.";
			}
			moveObject(state, id, "inventory");
			return "Taken.";
		}
		const feedback: string[] = [];
		let takenCount = 0;
		for (const id of ids) {
			const obj = world.objects[id];
			const name = obj?.name ?? id;
			if (isInInventory(state, id)) {
				feedback.push(`${name}: You're already carrying that.`);
				continue;
			}
			if (state.objects[id]?.state.carriable === false) {
				feedback.push(`${name}: ${obj?.descriptions.cant_take ?? "You can't take that."}`);
				continue;
			}
			if (isInRoom(state, id) || findOpenContainerInRoom(state, id)) {
				moveObject(state, id, "inventory");
				feedback.push(`${name}: Taken.`);
				takenCount++;
				continue;
			}
			feedback.push(`${name}: You don't see that here.`);
		}
		if (takenCount === 0) {
			stop();
		}
		return feedback;
	},
};
