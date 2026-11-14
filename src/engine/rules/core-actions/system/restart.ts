import type { z } from "zod";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const restart: ActionDef<z.infer<typeof emptySchema>> = {
	inputSchema: emptySchema,
	aliases: ["restart game"],
	description: "restart(): Restart the game from the beginning.",
	execute: () => "Restarting the game.",
};
