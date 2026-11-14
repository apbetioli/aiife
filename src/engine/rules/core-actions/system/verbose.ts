import type { z } from "zod";
import { setDescriptionMode } from "../../../mutators";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const verbose: ActionDef<z.infer<typeof emptySchema>> = {
	inputSchema: emptySchema,
	description:
		"verbose(): Set room descriptions to verbose mode (always print full room description on every turn/visit).",
	execute: (_params, { state }) => {
		setDescriptionMode(state, "verbose");
		return "Maximum verbosity.";
	},
};
