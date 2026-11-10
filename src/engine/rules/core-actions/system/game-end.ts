import type { z } from "zod";
import { victorySchema } from "../schemas";
import type { ActionDef } from "../types";

export const gameEnd: ActionDef<z.infer<typeof victorySchema>> = {
	inputSchema: victorySchema,
	description: "",
	execute: () => undefined,
};
