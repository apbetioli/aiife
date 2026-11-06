import type { ParserContext } from "../src/world/types";

// ─── Intent Recognition Evaluations ──────────────────────────────────────────

export interface IntentRecognitionEvalData {
	prompt: string;
	context: ParserContext;
	availableActions: string[];
	config?: { model?: string; temperature?: number };
}

export interface IntentRecognitionEvalTarget {
	expectedAction: string;
	expectedParams: Record<string, unknown>;
	category: "golden" | "secondary" | "negative";
	/** For secondary: actions that count as correct (defaults to [expectedAction]) */
	acceptableActions?: string[];
	/** For negative: actions that must NOT be selected */
	forbiddenActions?: string[];
}

export interface IntentRecognitionDatasetEntry {
	data: IntentRecognitionEvalData;
	target: IntentRecognitionEvalTarget;
	metadata?: { description?: string };
}

export type IntentRecognitionResult = {
	action: string;
	params: Record<string, unknown>;
};
