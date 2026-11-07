import type { z } from "zod";
import { roomSchema } from "../schemas";
import type { ActionDef } from "../types";

export const enter: ActionDef<z.infer<typeof roomSchema>> = {
	schema: roomSchema,
	description: "",
	handler: () => undefined,
};
