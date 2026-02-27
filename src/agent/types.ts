import z from "zod";

export interface ActionResult {
	message: string;
	success: boolean;
	gameOver?: boolean;
	isVictory?: boolean;
}
export interface ParsePattern {
	pattern: RegExp;
	extract: (match: RegExpMatchArray) => Record<string, unknown>;
}

export interface ActionDefinition {
	name: string;
	description: string;
	helpText: string;
}

export interface GameAction {
	action: string;
	params: Record<string, unknown>;
}

export const StructuredOutputSchema = z.object({
	action: z.string(),
	direction: z.string().nullable(),
	items: z.array(z.string()).nullable(),
	target: z.string().nullable(),
	npc: z.string().nullable(),
	message: z.string().nullable(),
});

export type StructuredOutput = z.infer<typeof StructuredOutputSchema>;

export type StructuredOutputResult = {
	action: string;
	params: Record<string, unknown>;
};
