import { z } from "zod";
import type { ActionDefSchemaOnly } from "./types";
import { emptySchema } from "./schemas";

export const gameStart: ActionDefSchemaOnly<z.infer<typeof emptySchema>> = {
	schema: emptySchema,
	description: "",
};
