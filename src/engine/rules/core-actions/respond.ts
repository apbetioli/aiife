import type { z } from "zod";
import { messageSchema } from "./schemas";
import type { ActionDefSchemaOnly } from "./types";

export const respond: ActionDefSchemaOnly<z.infer<typeof messageSchema>> = {
	schema: messageSchema,
	description:
		"respond(message): Reply without changing game state. Use when input is ambiguous or incomplete (e.g. 'take' or 'drop' with no object and multiple options — ask e.g. 'What do you want to take?').",
};
