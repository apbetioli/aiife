import type { z } from "zod";
import { isInInventory, setObjectState } from "../../../mutators";
import { getInstrument, getTarget } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const unlock: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description: "unlock(objects): Unlock something. objects: [target_id] or [target_id, key_id] if a key is specified.",
	scope: (ctx) =>
		ctx.in_scope_objects.some((o) => (o.type === "container" || o.type === "door") && o.state?.locked === true),
	execute: (params, { state, world, stop }) => {
		const target = getTarget(params as { objects?: string[] });
		const instrument = getInstrument(params as { objects?: string[] });
		if (!instrument || !isInInventory(state, instrument)) {
			stop();
			return "You don't have anything to unlock it with.";
		}
		const obj = world.objects[target];
		const requiredKey = obj?.requires_instrument?.unlock;
		if (requiredKey && instrument !== requiredKey) {
			stop();
			return "That doesn't fit the lock.";
		}
		setObjectState(state, target, "locked", false);
	},
};
