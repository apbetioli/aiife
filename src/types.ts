import type { LanguageModelUsage } from "ai";

export interface AgentCallbacks {
	onToken: (token: string) => void;
	onComplete: (response: string) => void;
	onTokenUsage?: (usage: LanguageModelUsage) => void;
}
