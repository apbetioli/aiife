import { Box } from "ink";
import type { ActionPack, GameSetup } from "../engine/rules";
import type { World } from "../world/types";
import { Input, MessageList, Spinner, Text, TokenUsage } from "./components";
import { IS_DEBUG } from "./helpers";
import { useGameSession } from "./hooks/use-game-session";

interface Props {
	world: World;
	setup?: GameSetup;
	actions?: ActionPack | ActionPack[];
}

export function App({ world, setup, actions }: Props) {
	const { messages, streamingText, handleSubmit, isLoading, tokenUsage } = useGameSession(world, {
		setup,
		actions,
	});

	const isThinking = isLoading && !streamingText;

	const header = (
		<Box>
			<Text bold color="magenta">
				🤖 Hi, I'm the Dungeon Master.
			</Text>
			<Text dimColor> (type "quit" to quit)</Text>
		</Box>
	);

	return (
		<Box flexDirection="column" gap={1}>
			<MessageList messages={messages} header={header} />

			{streamingText && (
				<Box>
					<Text>{streamingText}</Text>
					<Text color="gray">▌</Text>
				</Box>
			)}

			{isThinking && <Spinner />}

			<Input onSubmit={handleSubmit} disabled={isLoading} color="blue" />

			{IS_DEBUG && <TokenUsage turnUsage={tokenUsage.turnUsage} sessionUsage={tokenUsage.sessionUsage} />}
		</Box>
	);
}
