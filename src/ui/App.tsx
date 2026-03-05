import type { ModelMessage } from "ai";
import { Box, useApp } from "ink";
import { useCallback, useState } from "react";
import world from "../../games/the-great-hall.ts";
import { GameAgent } from "../agent/game-agent.ts";
import { createModel } from "../agent/model.ts";
import { GameEngine } from "../engine/game-engine.ts";
import type { TokenUsageInfo, ToolApprovalRequest } from "../types.ts";
import { Input } from "./components/Input.tsx";
import { type Message, MessageList } from "./components/MessageList.tsx";
import { Spinner } from "./components/Spinner.tsx";
import Text from "./components/Text.tsx";
import { TokenUsage } from "./components/TokenUsage.tsx";
import { ToolApproval } from "./components/ToolApproval.tsx";
import { ToolCall, type ToolCallProps } from "./components/ToolCall.tsx";

interface ActiveToolCall extends ToolCallProps {
	id: string;
}

const engine = new GameEngine(world);
const agent = new GameAgent(createModel(), engine);

export function App() {
	const { exit } = useApp();
	const [messages, setMessages] = useState<Message[]>([]);
	const [conversationHistory, setConversationHistory] = useState<
		ModelMessage[]
	>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const [activeToolCalls, setActiveToolCalls] = useState<ActiveToolCall[]>([]);
	const [pendingApproval, setPendingApproval] =
		useState<ToolApprovalRequest | null>(null);
	const [tokenUsage, setTokenUsage] = useState<TokenUsageInfo | null>(null);

	const handleSubmit = useCallback(
		async (userInput: string) => {
			if (userInput.toLowerCase() === "quit") {
				exit();
				return;
			}

			setMessages((prev) => [...prev, { role: "user", content: userInput }]);
			setIsLoading(true);
			setStreamingText("");
			setActiveToolCalls([]);

			try {
				const newHistory = await agent.run(userInput, conversationHistory, {
					onToken: (token) => {
						setStreamingText((prev) => prev + token);
					},
					onToolCallStart: (name, args) => {
						setActiveToolCalls((prev) => [
							...prev,
							{
								id: `${name}-${Date.now()}`,
								name,
								args,
								status: "pending",
							},
						]);
					},
					onToolCallEnd: (name, result) => {
						setActiveToolCalls((prev) =>
							prev.map((tc) =>
								tc.name === name && tc.status === "pending"
									? { ...tc, status: "complete", result }
									: tc,
							),
						);
					},
					onComplete: (response) => {
						if (response) {
							setMessages((prev) => [
								...prev,
								{ role: "assistant", content: response },
							]);
						}
						setStreamingText("");
						setActiveToolCalls([]);
					},
					onToolApproval: (name, args) => {
						return new Promise<boolean>((resolve) => {
							setPendingApproval({ toolName: name, args, resolve });
						});
					},
					onTokenUsage: (usage) => {
						setTokenUsage(usage);
					},
				});

				setConversationHistory(newHistory);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error";
				setMessages((prev) => [
					...prev,
					{ role: "assistant", content: `Error: ${errorMessage}` },
				]);
			} finally {
				setIsLoading(false);
			}
		},
		[conversationHistory, exit],
	);

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color="magenta">
					🤖 AI Dungeon Master
				</Text>
				<Text dimColor> (type "quit" to quit)</Text>
			</Box>

			<Box flexDirection="column" marginBottom={1}>
				<MessageList messages={messages} />

				{streamingText && (
					<Box marginLeft={2}>
						<Text>{streamingText}</Text>
						<Text color="gray">▌</Text>
					</Box>
				)}

				{activeToolCalls.length > 0 && !pendingApproval && (
					<Box flexDirection="column" marginTop={1}>
						{activeToolCalls.map((tc) => (
							<ToolCall
								key={tc.id}
								name={tc.name}
								args={tc.args}
								status={tc.status}
								result={tc.result}
							/>
						))}
					</Box>
				)}

				{isLoading &&
					!streamingText &&
					activeToolCalls.length === 0 &&
					!pendingApproval && (
						<Box marginTop={1}>
							<Spinner />
						</Box>
					)}

				{pendingApproval && (
					<ToolApproval
						toolName={pendingApproval.toolName}
						args={pendingApproval.args}
						onResolve={(approved) => {
							pendingApproval.resolve(approved);
							setPendingApproval(null);
						}}
					/>
				)}
			</Box>

			{!pendingApproval && (
				<Input onSubmit={handleSubmit} disabled={isLoading} color="blue" />
			)}

			<TokenUsage usage={tokenUsage} />
		</Box>
	);
}
