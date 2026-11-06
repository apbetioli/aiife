import type { z } from "zod";
import { emptySchema } from "./schemas";
import type { ActionDef } from "./types";

export const undo: ActionDef<z.infer<typeof emptySchema>> = {
	schema: emptySchema,
	aliases: [],
	description: "undo(): Revert the previous turn. No parameters.",
};
