import type { LanguageModelUsage } from "ai";
import { useCallback, useState } from "react";

function addUsage(a: LanguageModelUsage, b: LanguageModelUsage): LanguageModelUsage {
	return {
		inputTokens: (a.inputTokens ?? 0) + (b.inputTokens ?? 0),
		outputTokens: (a.outputTokens ?? 0) + (b.outputTokens ?? 0),
		totalTokens: (a.totalTokens ?? 0) + (b.totalTokens ?? 0),
		inputTokenDetails: a.inputTokenDetails,
		outputTokenDetails: a.outputTokenDetails,
	};
}

export function useTokenUsage() {
	const [usage, setUsage] = useState<{
		turnUsage: LanguageModelUsage | null;
		sessionUsage: LanguageModelUsage | null;
	}>({
		turnUsage: null,
		sessionUsage: null,
	});

	const onTokenUsage = useCallback((usage: LanguageModelUsage | null) => {
		if (usage === null) {
			setUsage((prev) => ({
				turnUsage: null,
				sessionUsage: prev.sessionUsage,
			}));
			return;
		}
		setUsage((prev) => ({
			turnUsage: prev.turnUsage ? addUsage(prev.turnUsage, usage) : usage,
			sessionUsage: prev.sessionUsage ? addUsage(prev.sessionUsage, usage) : usage,
		}));
	}, []);

	return [usage, onTokenUsage] as const;
}
