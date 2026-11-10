import type { z } from "zod";
import { setObjectState } from "../../../mutators";
import { getTarget } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const lock: ActionDef<z.infer<typeof objectsSchema>> = {
	inputSchema: objectsSchema,
	description: "lock(objects): Lock something. objects: [target_id] or [target_id, key_id] if a key is specified.",
	scope: (ctx) =>
		ctx.in_scope_objects.some((o) => (o.type === "container" || o.type === "door") && o.state?.locked === false),
	execute: (params, { state }) => {
		setObjectState(state, getTarget(params as { objects?: string[] }), "locked", true);
	},
};
