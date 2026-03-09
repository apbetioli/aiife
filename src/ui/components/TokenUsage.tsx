import type { LanguageModelUsage } from "ai";
import { Box, Text } from "ink";

interface TokenUsageProps {
	turnUsage: LanguageModelUsage | null;
	sessionUsage: LanguageModelUsage | null;
}

export function TokenUsage({ turnUsage, sessionUsage }: TokenUsageProps) {
	if (!turnUsage && !sessionUsage) {
		return null;
	}

	const turnTokens = turnUsage?.totalTokens ?? 0;
	const sessionTokens = sessionUsage?.totalTokens ?? 0;

	return (
		<Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
			<Text dimColor>Turn: </Text>
			<Text>{turnTokens} tokens</Text>
			<Text dimColor> ({sessionTokens} session total)</Text>
		</Box>
	);
}
