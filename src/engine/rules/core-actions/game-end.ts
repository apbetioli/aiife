import type { z } from "zod";
import { victorySchema } from "./schemas";
import type { ActionDefSchemaOnly } from "./types";

export const gameEnd: ActionDefSchemaOnly<z.infer<typeof victorySchema>> = {
	schema: victorySchema,
	description: "",
};
