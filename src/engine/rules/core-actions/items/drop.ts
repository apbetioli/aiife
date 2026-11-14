import type { z } from "zod";
import { isInInventory, moveObject } from "../../../mutators";
import { getObjectIds } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const drop: ActionDef<z.infer<typeof objectsSchema>> = {
	inputSchema: objectsSchema,
	aliases: ["put down", "discard"],
	description:
		'drop(objects): Drop objects from inventory. For "drop all", list every inventory object id. For "drop all but X", list every inventory object id except X. For "drop X and Y", list [X, Y]. For single "drop X", list [X].',
	scope: (ctx) => ctx.in_scope_objects.some((o) => o.source === "inventory"),
	execute: (params, { state, world, stop }) => {
		const ids = getObjectIds(params);
		if (ids.length === 0) {
			stop();
			return "Drop what?";
		}
		const toDrop = ids.filter((id) => isInInventory(state, id));
		if (toDrop.length === 0) {
			stop();
			return ids.length === 1 ? "You're not carrying that." : "You're not carrying any of those.";
		}
		const roomId = state.player.current_room;
		for (const id of toDrop) {
			moveObject(state, id, roomId);
		}
		if (toDrop.length === ids.length) {
			return "Dropped.";
		}
		return ids.map((id) =>
			toDrop.includes(id)
				? `${world.objects[id]?.name ?? id}: Dropped.`
				: `${world.objects[id]?.name ?? id}: You're not carrying that.`,
		);
	},
};
