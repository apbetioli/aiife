import { z } from "zod";
import { setObjectState } from "../../mutators";
import type { ActionDef } from "./types";
import { getTarget } from "./types";
import { objectsSchema } from "./schemas";

export const lock: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description: "lock(objects): Lock something. objects: [target_id] or [target_id, key_id] if a key is specified.",
	handler: (event, state, _world) => ({
		state: setObjectState(state, getTarget(event.params as { objects?: string[] }), "locked", true),
	}),
};
