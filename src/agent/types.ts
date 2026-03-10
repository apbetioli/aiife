import z from "zod";

// All param fields from player-facing core actions, made nullable.
// The SDK doesn't accept optional fields.
// If you add a param field to a core action, add it here too so the LLM can output it.
// TODO can we infer this from the registered actions?
export const IntentRecognitionSchema = z.object({
	action: z.string(),
	direction: z.string().nullable(),
	objects: z.array(z.string()).nullable(),
	preposition: z.string().nullable(),
	message: z.string().nullable(),
});

export type RecognizedIntent = z.infer<typeof IntentRecognitionSchema>;
