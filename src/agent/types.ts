export {
	type StructuredOutput,
	StructuredOutputSchema,
} from "../engine/rules/action-registry";

export interface ActionResult {
	message: string;
	success: boolean;
	gameOver?: boolean;
	isVictory?: boolean;
	/** Action that was performed (e.g. "take", "drop"). Used by narrator for fallback when message is generic. */
	action?: string;
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

export type StructuredOutputResult = {
	action: string;
	params: Record<string, unknown>;
};
