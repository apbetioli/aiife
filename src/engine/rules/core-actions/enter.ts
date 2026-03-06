import type { z } from "zod";
import { roomSchema } from "./schemas";
import type { ActionDefSchemaOnly } from "./types";

export const enter: ActionDefSchemaOnly<z.infer<typeof roomSchema>> = {
	schema: roomSchema,
	description: "",
};
