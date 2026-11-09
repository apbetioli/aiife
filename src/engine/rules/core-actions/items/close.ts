import type { z } from "zod";
import { setObjectState } from "../../../mutators";
import { resolveTarget } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const close: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	aliases: ["shut"],
	description: "close(objects): Close a container or door. objects: [target_id].",
	scope: (ctx) =>
		ctx.in_scope_objects.some((o) => (o.type === "container" || o.type === "door") && o.state?.open === true),
	execute: (params, { state, world, stop }) => {
		const target = resolveTarget(params, state, world);
		if (!target) {
			stop();
			return "Close what?";
		}
		const { targetId, obj, objState } = target;
		if (obj.type !== "container" && obj.type !== "door") {
			stop();
			return "You can't close that.";
		}
		if (objState.state.open === false) {
			stop();
			return "It's already closed.";
		}
		setObjectState(state, targetId, "open", false);
		return "Closed.";
	},
};
