import type { LanguageModelUsage } from "ai";

export interface AgentCallbacks {
	onToken: (token: string) => void;
	onComplete: (response: string) => void;
	onTokenUsage?: (usage: LanguageModelUsage) => void;
}

export interface RecognizedIntent {
	action: string;
	direction?: string | null;
	objects?: string[] | null;
	preposition?: string | null;
	message?: string | null;
	slot?: string | null;
	[key: string]: unknown;
}
