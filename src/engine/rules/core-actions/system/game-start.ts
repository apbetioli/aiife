import type { z } from "zod";
import { emptySchema } from "../schemas";
import type { ActionDef } from "../types";

export const gameStart: ActionDef<z.infer<typeof emptySchema>> = {
	schema: emptySchema,
	description: "",
	execute: () => undefined,
};
