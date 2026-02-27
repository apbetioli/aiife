/**
 * Input data for single-turn tool selection evaluations.
 * Tests whether the LLM selects the correct tools without executing them.
 */
export interface EvalData {
	/** The user prompt to test */
	prompt: string;
	/** Optional system prompt override (uses default if not provided) */
	systemPrompt?: string;
	/** Tool names to make available for this evaluation */
	tools: string[];
	/** Configuration for the LLM call */
	config?: {
		model?: string;
		temperature?: number;
	};
}

/**
 * Target expectations for single-turn evaluations
 */
export interface EvalTarget {
	/** Tools that MUST be selected (golden prompts) */
	expectedTools?: string[];
	/** Tools that MUST NOT be selected (negative prompts) */
	forbiddenTools?: string[];
	/** Category for grouping and filtering */
	category: "golden" | "secondary" | "negative";
}

/**
 * Metadata for single-turn evaluations
 */
export interface EvalMetadata {
	description?: string;
}

/**
 * Single entry in a single-turn evaluation dataset
 */
export interface SingleTurnDatasetEntry {
	data: EvalData;
	target: EvalTarget;
	metadata?: EvalMetadata;
}

/**
 * Result from single-turn executor
 */
export interface SingleTurnResult {
	/** Raw tool calls from the LLM */
	toolCalls: Array<{ toolName: string; args: unknown }>;
	/** Just the tool names for easy comparison */
	toolNames: string[];
	/** Whether any tool was selected */
	selectedAny: boolean;
}

/**
 * Mock tool configuration for multi-turn evaluations.
 * Tools return fixed values for deterministic testing.
 */
export interface MockToolConfig {
	/** Tool description shown to the LLM */
	description: string;
	/** Parameter schema (simplified - all params treated as strings) */
	parameters: Record<string, string>;
	/** Fixed return value when tool is called */
	mockReturn: string;
}

// --- Structured Output Intent Recognition ---

export interface GameStateSnapshot {
	roomName: string;
	roomDescription: string;
	exits: Array<{ direction: string; locked?: boolean }>;
	visibleItems: string[];
	inventory: string[];
	npcsHere: string[];
}

export interface StructuredOutputEvalData {
	prompt: string;
	gameState: GameStateSnapshot;
	availableActions: string[];
	config?: { model?: string; temperature?: number };
}

export interface StructuredOutputEvalTarget {
	expectedAction: string;
	expectedParams: Record<string, unknown>;
	category: "golden" | "secondary" | "negative";
	/** For secondary: actions that count as correct (defaults to [expectedAction]) */
	acceptableActions?: string[];
	/** For negative: actions that must NOT be selected */
	forbiddenActions?: string[];
}

export interface StructuredOutputResult {
	action: string;
	params: Record<string, unknown>;
	/** Whether the output was produced by the model and matches the target */
	produced: boolean;
}

export interface StructuredOutputDatasetEntry {
	data: StructuredOutputEvalData;
	target: StructuredOutputEvalTarget;
	metadata?: { description?: string };
}
