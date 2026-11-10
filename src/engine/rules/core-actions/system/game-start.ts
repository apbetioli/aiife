import type { z } from "zod";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const gameStart: ActionDef<z.infer<typeof emptySchema>> = {
	inputSchema: emptySchema,
	description: "",
	execute: () => undefined,
};
