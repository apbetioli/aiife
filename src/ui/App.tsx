import type { ModelMessage } from "ai";
import { Box, useApp } from "ink";
import { useCallback, useMemo, useState } from "react";
import { GameAgent } from "../agent/game-agent.ts";
import { createNarratorModel, createParserModel } from "../agent/model.ts";
import { GameEngine } from "../engine/game-engine.ts";
import type { GameSetup } from "../engine/rules/index.ts";
import type { GameEvent } from "../engine/rules/types.ts";
import type { TokenUsageInfo } from "../types.ts";
import type { World } from "../world/types.ts";
import { Input } from "./components/Input.tsx";
import { type Message, MessageList } from "./components/MessageList.tsx";
import { Spinner } from "./components/Spinner.tsx";
import Text from "./components/Text.tsx";
import { TokenUsage } from "./components/TokenUsage.tsx";

const isDebug = process.env.DEBUG === "true";

interface AppProps {
	world: World;
	setup?: GameSetup;
}

function useMessages(): [Message[], (message: Message) => void] {
	const [messages, setMessages] = useState<Message[]>([]);

	const addMessage = useCallback((message: Message) => {
		setMessages((prev) => [...prev, { ...message, id: crypto.randomUUID() }]);
	}, []);

	return [messages, addMessage] as const;
}

function useGameSession(world: World, setup?: GameSetup) {
	const { exit } = useApp();

	const [messages, addMessage] = useMessages();
	const [conversationHistory, setConversationHistory] = useState<ModelMessage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const [tokenUsage, setTokenUsage] = useState<TokenUsageInfo | null>(null);

	const onEvent = useCallback(
		(event: GameEvent) => {
			addMessage({ role: "tool", content: `${event.name} ${JSON.stringify(event.params)}` });
		},
		[addMessage],
	);

	const onQuit = useCallback(
		(event: GameEvent) => {
			if (event.name === "quit") {
				setTimeout(exit, 1000);
			}
		},
		[exit],
	);

	const onToken = useCallback((token: string) => {
		setStreamingText((prev) => prev + token);
	}, []);

	const onComplete = useCallback(
		(response: string) => {
			addMessage({ role: "assistant", content: response });
			setStreamingText("");
		},
		[addMessage],
	);

	const onTokenUsage = useCallback((usage: TokenUsageInfo) => {
		setTokenUsage(usage);
	}, []);

	const { agent } = useMemo(() => {
		const engine = new GameEngine(world, setup);
		engine.addObserver(onEvent);
		engine.addObserver(onQuit);
		const introMessage = engine.start();
		addMessage({ role: "assistant", content: introMessage });
		const agent = new GameAgent(createParserModel(), engine, createNarratorModel());
		return { agent };
	}, [world, setup, addMessage, onEvent, onQuit]);

	const handleSubmit = async (userInput: string) => {
		addMessage({ role: "user", content: userInput });
		setIsLoading(true);
		setStreamingText("");

		try {
			const newHistory = await agent.run(userInput, conversationHistory, {
				onToken,
				onComplete,
				onTokenUsage,
			});

			setConversationHistory(newHistory);
		} catch (error) {
			const message = isDebug
				? error instanceof Error
					? (error.stack ?? String(error))
					: String(error)
				: "The dungeon master had some urgent business to attend to.";

			addMessage({ role: "assistant", content: `Oops! ${message}` });
		} finally {
			setIsLoading(false);
		}
	};

	return {
		messages,
		streamingText,
		handleSubmit,
		isLoading,
		tokenUsage,
	};
}

export function App({ world, setup }: AppProps) {
	const { messages, streamingText, handleSubmit, isLoading, tokenUsage } = useGameSession(world, setup);

	const isThinking = isLoading && !streamingText;

	return (
		<Box flexDirection="column">
			<Box marginBottom={1}>
				<Text bold color="magenta">
					🤖 Hi, I'm the Dungeon Master.
				</Text>
				<Text dimColor> (type "quit" to quit)</Text>
			</Box>

			<Box flexDirection="column" marginBottom={1} gap={2}>
				<MessageList messages={messages} />

				{streamingText && (
					<Box>
						<Text>{streamingText}</Text>
						<Text color="gray">▌</Text>
					</Box>
				)}

				{isThinking && <Spinner />}
			</Box>

			<Input onSubmit={handleSubmit} disabled={isLoading} color="blue" />

			{isDebug && <TokenUsage usage={tokenUsage} />}
		</Box>
	);
}
