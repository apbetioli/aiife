import type { z } from "zod";
import { roomSchema } from "./schemas";
import type { ActionDefSchemaOnly } from "./types";

export const exit: ActionDefSchemaOnly<z.infer<typeof roomSchema>> = {
	schema: roomSchema,
	description: "",
};
