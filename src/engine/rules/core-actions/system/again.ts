import type { z } from "zod";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const again: ActionDef<z.infer<typeof emptySchema>> = {
	inputSchema: emptySchema,
	aliases: ["g", "repeat"],
	description: "again(): Repeat the previous command. Shorthand: g.",
	execute: () => "Time passes...",
};
