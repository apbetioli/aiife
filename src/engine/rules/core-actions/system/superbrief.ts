import type { z } from "zod";
import { setDescriptionMode } from "../../../mutators";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const superbrief: ActionDef<z.infer<typeof emptySchema>> = {
	inputSchema: emptySchema,
	aliases: ["super-brief", "super_brief"],
	description:
		"superbrief(): Set room descriptions to superbrief mode (always print only room name and objects, never full room description).",
	execute: (_params, { state }) => {
		setDescriptionMode(state, "superbrief");
		return "Superbrief descriptions.";
	},
};
