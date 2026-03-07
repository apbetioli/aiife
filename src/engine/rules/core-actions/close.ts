import type { z } from "zod";
import { setObjectState } from "../../mutators";
import { resolveTarget } from "./helpers";
import { objectsSchema } from "./schemas";
import type { ActionDef } from "./types";

export const close: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description: "close(objects): Close a container or door. objects: [target_id].",
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world);
		if (!target) {
			event.stop();
			return "Close what?";
		}
		const { targetId, obj, objState } = target;
		if (obj.type !== "container" && obj.type !== "door") {
			event.stop();
			return "You can't close that.";
		}
		if (objState.state.open === false) {
			event.stop();
			return "It's already closed.";
		}
		setObjectState(state, targetId, "open", false);
	},
};
