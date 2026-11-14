import type { z } from "zod";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const wait: ActionDef<z.infer<typeof emptySchema>> = {
	inputSchema: emptySchema,
	aliases: ["z", "wait for time to pass"],
	description: "wait(): Wait for time to pass. Shorthand: z.",
	execute: () => "Time passes...",
};
