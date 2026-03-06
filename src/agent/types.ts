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

export type StructuredOutputResult = {
	action: string;
	params: Record<string, unknown>;
};
