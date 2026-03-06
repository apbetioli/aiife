// ─── Parser Schema (flat shape for LLM structured output) ───────────────────
// All param fields from player-facing core actions, made nullable.
// If you add a param field to a core action, add it here too — the runtime
// check below will throw if they drift apart.

import z from "zod";
import { coreActionDefinitions } from "../engine/rules/core-actions";

export const StructuredOutputSchema = z.object({
	action: z.string(),
	direction: z.string().nullable(),
	objects: z.array(z.string()).nullable(),
	preposition: z.string().nullable(),
	message: z.string().nullable(),
});

export type StructuredOutput = z.infer<typeof StructuredOutputSchema>;

// Runtime drift check: every param field in a player-facing action must exist
// in StructuredOutputSchema. Runs once at import time.
(function assertParserSchemaCoversActions() {
	const parserKeys = new Set(Object.keys(StructuredOutputSchema.shape));
	for (const [name, entry] of Object.entries(coreActionDefinitions)) {
		if (!entry.description) continue;
		for (const key of Object.keys((entry.schema as z.ZodObject<z.ZodRawShape>).shape)) {
			if (!parserKeys.has(key)) {
				throw new Error(
					`StructuredOutputSchema is missing field "${key}" from action "${name}". Add it as a nullable field.`,
				);
			}
		}
	}
})();
