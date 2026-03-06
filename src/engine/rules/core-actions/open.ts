import type { z } from "zod";
import { setObjectState } from "../../mutators";
import { objectsSchema } from "./schemas";
import { resolveTarget } from "./helpers";
import type { ActionDef } from "./types";

export const open: ActionDef<z.infer<typeof objectsSchema>> = {
	schema: objectsSchema,
	description:
		"open(objects): Open a container or door. objects: [target_id]. Use only when the player explicitly asks to open (e.g. 'open the box').",
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world, { missingMessage: "Open what?", presence: "any" });
		if (!target) return state;
		const { targetId, obj, objState } = target;
		if (obj.type !== "container" && obj.type !== "door") {
			event.stop("You can't open that.");
			return state;
		}
		if (objState.state.locked === true) {
			event.stop("It's locked.");
			return state;
		}
		if (objState.state.open === true) {
			event.stop("It's already open.");
			return state;
		}
		const nextState = setObjectState(state, targetId, "open", true);
		const contents = (objState?.contains ?? []).map((id) => world.objects[id]?.name).filter(Boolean);
		const name = obj?.name ?? targetId;
		const feedback =
			contents.length > 0 ? `Opening the ${name} reveals:\n${contents.map((n) => `  ${n}`).join("\n")}` : `Opened.`;
		return { state: nextState, feedback: [feedback] };
	},
};
