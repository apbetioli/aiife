import type { z } from "zod";
import { setDescriptionMode } from "../../../mutators";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const brief: ActionDef<z.infer<typeof emptySchema>> = {
	inputSchema: emptySchema,
	description:
		"brief(): Set room descriptions to brief mode (full description on first visit, short/visited or room name on subsequent visits).",
	execute: (_params, { state }) => {
		setDescriptionMode(state, "brief");
		return "Brief descriptions.";
	},
};
