import { z } from "zod";
import type { ActionDef } from "./types";

const saveSchema = z.object({
	slot: z.string().optional(),
});

export const saveAction: ActionDef<z.infer<typeof saveSchema>> = {
	schema: saveSchema,
	aliases: [],
	description: "save(slot): Save the current game state to disk. Optional slot name.",
};
