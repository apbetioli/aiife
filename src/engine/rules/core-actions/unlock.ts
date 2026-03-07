import type { z } from "zod";
import { isInInventory, setObjectState } from "../../mutators";
import { getInstrument, getTarget } from "./helpers";
import { objectsSchema } from "./schemas";
import type { ActionDef } from "./types";

export const unlock: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description: "unlock(objects): Unlock something. objects: [target_id] or [target_id, key_id] if a key is specified.",
	handler: (event, state, world) => {
		const target = getTarget(event.params as { objects?: string[] });
		const instrument = getInstrument(event.params as { objects?: string[] });
		if (!instrument || !isInInventory(state, instrument)) {
			event.stop();
			return "You don't have anything to unlock it with.";
		}
		const obj = world.objects[target];
		const requiredKey = obj?.requires_instrument?.unlock;
		if (requiredKey && instrument !== requiredKey) {
			event.stop();
			return "That doesn't fit the lock.";
		}
		setObjectState(state, target, "locked", false);
	},
};
