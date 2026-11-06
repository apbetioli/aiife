import type { ModelMessage } from "ai";
import { useApp } from "ink";
import { useCallback, useEffect, useRef, useState } from "react";
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

	const onEventRef = useRef<(event: GameEvent) => void>(() => {});
	onEventRef.current = (event: GameEvent) => {
		addMessage({ role: "tool", content: `${event.name} ${JSON.stringify(event.params)}` });
	};

	const onQuitRef = useRef<(event: GameEvent) => void>(() => {});
	onQuitRef.current = (event: GameEvent) => {
		if (event.name === "quit") {
			setTimeout(exit, 1000);
		}
	};

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

	const engineRef = useRef<GameEngine | null>(null);
	const agentRef = useRef<GameAgent | null>(null);

	if (!engineRef.current) {
		const engine = new GameEngine(world, setup);
		engine.addObserver((event) => onEventRef.current(event));
		engine.addObserver((event) => onQuitRef.current(event));
		engineRef.current = engine;
		agentRef.current = new GameAgent(createParserModel(), engine, createNarratorModel());
	}

	useEffect(() => {
		if (engineRef.current) {
			const introMessage = engineRef.current.start();
			addMessage({ role: "assistant", content: introMessage });
		}
	}, [addMessage]);

	const handleSubmit = async (userInput: string) => {
		addMessage({ role: "user", content: userInput });
		setIsLoading(true);
		setStreamingText("");
		onTokenUsage(null);

		try {
			const newHistory = await agentRef.current!.run(userInput, conversationHistory, {
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
