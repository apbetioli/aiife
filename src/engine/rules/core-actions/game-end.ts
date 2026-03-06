import { z } from "zod";
import type { ActionDefSchemaOnly } from "./types";
import { victorySchema } from "./schemas";

export const gameEnd: ActionDefSchemaOnly<z.infer<typeof victorySchema>> = {
	schema: victorySchema,
	description: "",
};
