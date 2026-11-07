import type { z } from "zod";
import { messageSchema } from "../schemas";
import type { ActionDef } from "../types";

export const respond: ActionDef<z.infer<typeof messageSchema>> = {
	schema: messageSchema,
	description:
		"respond(message): Reply without changing game state. Use when input is ambiguous or incomplete (e.g. 'take' or 'drop' with no object and multiple options — ask e.g. 'What do you want to take?').",
	handler: (event) => event.params.message ?? "",
};
