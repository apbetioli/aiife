import type { z } from "zod";
import { setObjectState } from "../../mutators";
import { objectsSchema } from "./schemas";
import type { ActionDef } from "./types";
import { resolveTarget } from "./types";

export const close: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description: "close(objects): Close a container or door. objects: [target_id].",
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world, { missingMessage: "Close what?", presence: "any" });
		if (!target) return state;
		const { targetId, obj, objState } = target;
		if (obj.type !== "container" && obj.type !== "door") {
			event.stop("You can't close that.");
			return state;
		}
		if (objState.state.open === false) {
			event.stop("It's already closed.");
			return state;
		}
		return { state: setObjectState(state, targetId, "open", false) };
	},
};
