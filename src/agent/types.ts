// ─── Parser Schema (flat shape for LLM structured output) ───────────────────
// All param fields from player-facing core actions, made nullable.
// If you add a param field to a core action, add it here too — the runtime
// check below will throw if they drift apart.

import z from "zod";

export const StructuredOutputSchema = z.object({
	action: z.string(),
	direction: z.string().nullable(),
	objects: z.array(z.string()).nullable(),
	preposition: z.string().nullable(),
	message: z.string().nullable(),
});

export type StructuredOutput = z.infer<typeof StructuredOutputSchema>;
