import { z } from "zod";
import type { ActionDef } from "../types";

const restoreSchema = z.object({
	slot: z.string().optional(),
});

export const restoreAction: ActionDef<z.infer<typeof restoreSchema>> = {
	inputSchema: restoreSchema,
	aliases: ["load"],
	description: "restore(slot): Restore a previously saved game state from disk. Optional slot name.",
};
