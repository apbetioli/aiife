import type { z } from "zod";
import { roomSchema } from "../schemas";
import type { ActionDef } from "../types";

export const enter: ActionDef<z.infer<typeof roomSchema>> = {
	inputSchema: roomSchema,
	description: "",
	execute: () => undefined,
};
