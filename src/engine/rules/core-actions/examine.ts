import type { z } from "zod";
import { setObjectState } from "../../mutators";
import { resolveObjectDescriptionWithPreposition } from "../../parser-context";
import { resolveTarget } from "./helpers";
import { objectsWithPrepositionSchema } from "./schemas";
import type { ActionDef } from "./types";

export const examine: ActionDef<z.infer<typeof objectsWithPrepositionSchema>> = {
	schema: objectsWithPrepositionSchema,
	aliases: ["read", "x", "look at", "look in", "look under", "look behind", "look inside"],
	hint: "'look at/in/under/behind/inside <target>' maps here, not to look.",
	description:
		"examine(objects, preposition?): Look closely at an item, actor, or feature. objects: [target_id]. Shorthand: x. Use for 'look at X', 'look under X', 'look behind X', 'look in X', 'look inside X' — add preposition when examining a specific aspect. Omit preposition for plain 'look at' or 'examine'.",
	handler: (event, state, world) => {
		const target = resolveTarget(event, state, world);
		if (!target) {
			event.stop();
			return "Examine what?";
		}
		const { targetId, obj, objState } = target;
		const preposition = event.params.preposition?.trim();
		const description = resolveObjectDescriptionWithPreposition(obj, objState, preposition || undefined);
		setObjectState(state, targetId, "examined", true);
		return description;
	},
};
