import type { ModelMessage } from "ai";
import { Box, useApp } from "ink";
import { useCallback, useMemo, useState } from "react";
import { GameAgent, getErrorMessage } from "../agent/game-agent.ts";
import { createNarratorModel, createParserModel } from "../agent/model.ts";
import { GameEngine } from "../engine/game-engine.ts";
import type { TokenUsageInfo, ToolApprovalRequest } from "../types.ts";
import type { World } from "../world/types.ts";
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

export interface AppProps {
	world: World;
}

export function App({ world }: AppProps) {
	const { exit } = useApp();
	const { agent, introMessage } = useMemo(() => {
		const e = new GameEngine(world);
		const intro = e.start();
		const a = new GameAgent(createParserModel(), e, createNarratorModel());
		return { agent: a, introMessage: intro.message };
	}, [world]);
	const [messages, setMessages] = useState<Message[]>([
		{ role: "assistant", content: introMessage },
	]);
	const [conversationHistory, setConversationHistory] = useState<
		ModelMessage[]
	>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const [activeToolCalls, setActiveToolCalls] = useState<ActiveToolCall[]>([]);
	const [pendingApproval, setPendingApproval] =
		useState<ToolApprovalRequest | null>(null);
	const [tokenUsage, setTokenUsage] = useState<TokenUsageInfo | null>(null);

	const isDebug = process.env.DEBUG === "true";

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
				setMessages((prev) => [
					...prev,
					{ role: "assistant", content: `Oops! ${getErrorMessage(error)}` },
				]);
			} finally {
				setIsLoading(false);
			}
		},
		[agent, conversationHistory, exit],
	);

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold color="magenta">
					🤖 Dungeon Master
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

				{isDebug && activeToolCalls.length > 0 && !pendingApproval && (
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

			{isDebug && <TokenUsage usage={tokenUsage} />}
		</Box>
	);
}
