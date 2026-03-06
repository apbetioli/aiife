import type { z } from "zod";
import { isInInventory, setObjectState } from "../../mutators";
import { objectsSchema } from "./schemas";
import { getInstrument, getTarget } from "./helpers";
import type { ActionDef } from "./types";

export const unlock: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description: "unlock(objects): Unlock something. objects: [target_id] or [target_id, key_id] if a key is specified.",
	handler: (event, state, world) => {
		const target = getTarget(event.params as { objects?: string[] });
		const instrument = getInstrument(event.params as { objects?: string[] });
		if (!instrument || !isInInventory(state, instrument)) {
			event.stop("You don't have anything to unlock it with.");
			return state;
		}
		const obj = world.objects[target];
		const requiredKey = obj?.requires_instrument?.unlock;
		if (requiredKey && instrument !== requiredKey) {
			event.stop("That doesn't fit the lock.");
			return state;
		}
		return { state: setObjectState(state, target, "locked", false) };
	},
};
