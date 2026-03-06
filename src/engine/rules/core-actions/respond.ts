import { z } from "zod";
import type { ActionDefSchemaOnly } from "./types";
import { messageSchema } from "./schemas";

export const respond: ActionDefSchemaOnly<z.infer<typeof messageSchema>> = {
	schema: messageSchema,
	description:
		"respond(message): Reply without changing game state. Use when input is ambiguous or incomplete (e.g. 'take' or 'drop' with no object and multiple options — ask e.g. 'What do you want to take?').",
};
