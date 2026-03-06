import { z } from "zod";
import { resolveObjectDescriptionWithPreposition } from "../../parser-context";
import { setObjectState } from "../../mutators";
import type { ActionDef } from "./types";
import { resolveTarget } from "./types";
import { objectsWithPrepositionSchema } from "./schemas";

export const examine: ActionDef<z.infer<typeof objectsWithPrepositionSchema>> = {
	schema: objectsWithPrepositionSchema,
	description:
		"examine(objects, preposition?): Look closely at an item, actor, or feature. objects: [target_id]. Shorthand: x. Use for 'look at X', 'look under X', 'look behind X', 'look in X', look inside X — add preposition when examining a specific aspect. Omit preposition for plain 'look at' or 'examine'.",
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world, { missingMessage: "Examine what?" });
		if (!target) return state;
		const { targetId, obj, objState } = target;
		const preposition = event.params.preposition?.trim();
		const description = resolveObjectDescriptionWithPreposition(obj, objState, preposition || undefined);
		const nextState = setObjectState(state, targetId, "examined", true);
		return { state: nextState, feedback: [description] };
	},
};
