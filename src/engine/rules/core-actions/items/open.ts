import type { z } from "zod";
import { setObjectState } from "../../../mutators";
import { getObjectIds } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const open: ActionDef<z.infer<typeof objectsSchema>> = {
	inputSchema: objectsSchema,
	description:
		"open(objects): Open a container or door. objects: [target_id] or [id1, id2, ...]. Use only when the player explicitly asks to open (e.g. 'open the box', 'open all').",
	scope: (ctx) =>
		ctx.in_scope_objects.some((o) => (o.type === "container" || o.type === "door") && o.state?.open !== true),
	execute: (params, { state, world, stop }) => {
		const ids = getObjectIds(params);
		if (ids.length === 0) {
			stop();
			return "Open what?";
		}
		if (ids.length === 1) {
			const targetId = ids[0];
			const obj = world.objects[targetId];
			const objState = state.objects[targetId];
			if (!obj || !objState) {
				stop();
				return "Open what?";
			}
			if (obj.type !== "container" && obj.type !== "door") {
				stop();
				return "You can't open that.";
			}
			if (objState.state.locked === true) {
				stop();
				return "It's locked.";
			}
			if (objState.state.open === true) {
				stop();
				return "It's already open.";
			}
			setObjectState(state, targetId, "open", true);
			const contents = Object.keys(world.objects)
				.filter((id) => state.objects[id]?.location === targetId)
				.map((id) => world.objects[id]?.name)
				.filter(Boolean);
			const name = obj.name ?? targetId;
			return contents.length > 0
				? `Opening the ${name} reveals:\n${contents.map((n) => `  ${n}`).join("\n")}`
				: `Opened.`;
		}
		const feedback: string[] = [];
		for (const targetId of ids) {
			const obj = world.objects[targetId];
			const objState = state.objects[targetId];
			const name = obj?.name ?? targetId;
			if (!obj || !objState || (obj.type !== "container" && obj.type !== "door")) {
				feedback.push(`${name}: You can't open that.`);
				continue;
			}
			if (objState.state.locked === true) {
				feedback.push(`${name}: It's locked.`);
				continue;
			}
			if (objState.state.open === true) {
				feedback.push(`${name}: It's already open.`);
				continue;
			}
			setObjectState(state, targetId, "open", true);
			feedback.push(`${name}: Opened.`);
		}
		return feedback;
	},
};
