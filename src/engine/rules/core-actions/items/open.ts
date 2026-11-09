import type { z } from "zod";
import { setObjectState } from "../../../mutators";
import { resolveTarget } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const open: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description:
		"open(objects): Open a container or door. objects: [target_id]. Use only when the player explicitly asks to open (e.g. 'open the box').",
	scope: (ctx) =>
		ctx.in_scope_objects.some((o) => (o.type === "container" || o.type === "door") && o.state?.open !== true),
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world);
		if (!target) {
			event.stop();
			return "Open what?";
		}
		const { targetId, obj, objState } = target;
		if (obj.type !== "container" && obj.type !== "door") {
			event.stop();
			return "You can't open that.";
		}
		if (objState.state.locked === true) {
			event.stop();
			return "It's locked.";
		}
		if (objState.state.open === true) {
			event.stop();
			return "It's already open.";
		}
		setObjectState(state, targetId, "open", true);
		const contents = Object.keys(world.objects)
			.filter((id) => state.objects[id]?.location === targetId)
			.map((id) => world.objects[id]?.name)
			.filter(Boolean);
		const name = obj?.name ?? targetId;
		return contents.length > 0
			? `Opening the ${name} reveals:\n${contents.map((n) => `  ${n}`).join("\n")}`
			: `Opened.`;
	},
};
