import type { z } from "zod";
import { victorySchema } from "../schemas";
import type { ActionDef } from "../types";

export const gameEnd: ActionDef<z.infer<typeof victorySchema>> = {
	schema: victorySchema,
	description: "",
	handler: () => undefined,
};
