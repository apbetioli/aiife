import type { z } from "zod";
import { emptySchema } from "./schemas";
import type { ActionDefSchemaOnly } from "./types";

export const gameStart: ActionDefSchemaOnly<z.infer<typeof emptySchema>> = {
	schema: emptySchema,
	description: "",
};
