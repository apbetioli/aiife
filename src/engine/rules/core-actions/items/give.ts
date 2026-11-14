import type { z } from "zod";
import { isInInventory } from "../../../mutators";
import { getObjectIds } from "../helpers";
import { objectsSchema } from "../schemas";
import type { ActionDef } from "../types";

export const give: ActionDef<z.infer<typeof objectsSchema>> = {
	inputSchema: objectsSchema,
	aliases: ["offer", "feed", "hand"],
	description: "give(objects): Give or offer an object to someone. objects: [item_id, recipient_id].",
	execute: (params, { state, stop }) => {
		const ids = getObjectIds(params);
		if (ids.length === 0) {
			stop();
			return "Give what?";
		}
		const itemId = ids[0];
		if (!isInInventory(state, itemId)) {
			stop();
			return "You don't have that.";
		}
		if (ids.length < 2) {
			stop();
			return "Give it to whom?";
		}
		stop();
		return "They don't seem interested.";
	},
};
