export interface AgentCallbacks {
	onToken: (token: string) => void;
	onComplete: (response: string) => void;
	onTokenUsage?: (usage: TokenUsageInfo) => void;
}

export interface TokenUsageInfo {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	contextWindow: number;
	threshold: number;
	percentage: number;
}
