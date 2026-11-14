import type { z } from "zod";
import { isInInventory, moveObject } from "../../../mutators";
import { resolveTarget } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const throwAction: ActionDef<z.infer<typeof objectsSchema>> = {
	inputSchema: objectsSchema,
	aliases: ["toss", "hurl", "chuck", "pitch"],
	description: "throw(objects): Throw an object. objects: [object_id] or [object_id, target_id].",
	execute: (params, { state, world, stop }) => {
		const target = resolveTarget(params, state, world);
		if (!target) {
			stop();
			return "Throw what?";
		}
		const { targetId } = target;
		if (!isInInventory(state, targetId)) {
			stop();
			return "You don't have that.";
		}
		moveObject(state, targetId, state.player.current_room);
		return "Thrown.";
	},
};
