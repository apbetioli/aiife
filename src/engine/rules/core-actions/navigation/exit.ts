import type { z } from "zod";
import { roomSchema } from "../schemas";
import type { ActionDef } from "../types";

export const exit: ActionDef<z.infer<typeof roomSchema>> = {
	schema: roomSchema,
	description: "",
	execute: () => undefined,
};
