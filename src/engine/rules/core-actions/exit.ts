import { z } from "zod";
import type { ActionDefSchemaOnly } from "./types";
import { roomSchema } from "./schemas";

export const exit: ActionDefSchemaOnly<z.infer<typeof roomSchema>> = {
	schema: roomSchema,
	description: "",
};
