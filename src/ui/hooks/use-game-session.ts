import type { ModelMessage } from "ai";
import { useApp } from "ink";
import { useCallback, useMemo, useState } from "react";
import { GameAgent } from "../../agent/game-agent";
import { createNarratorModel, createParserModel } from "../../agent/model";
import { GameEngine } from "../../engine/game-engine";
import type { GameSetup } from "../../engine/rules";
import type { GameEvent } from "../../engine/rules/types";
import type { World } from "../../world/types";
import { getErrorDisplayMessage } from "../helpers";
import { useMessages } from "./use-messages.ts";
import { useTokenUsage } from "./use-token-usage.ts";

export function useGameSession(world: World, setup?: GameSetup) {
	const { exit } = useApp();

	const [messages, addMessage] = useMessages();
	const [conversationHistory, setConversationHistory] = useState<ModelMessage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const [tokenUsage, onTokenUsage] = useTokenUsage();

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
		onTokenUsage(null);

		try {
			const newHistory = await agent.run(userInput, conversationHistory, {
				onToken,
				onComplete,
				onTokenUsage,
			});

			setConversationHistory(newHistory);
		} catch (error) {
			addMessage({ role: "assistant", content: `Oops! ${getErrorDisplayMessage(error)}` });
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
