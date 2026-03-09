import { Box } from "ink";
import type { GameSetup } from "../engine/rules/index.ts";
import type { World } from "../world/types.ts";
import { Input } from "./components/Input.tsx";
import { MessageList } from "./components/MessageList.tsx";
import { Spinner } from "./components/Spinner.tsx";
import Text from "./components/Text.tsx";
import { TokenUsage } from "./components/TokenUsage.tsx";
import { IS_DEBUG } from "./helpers.ts";
import { useGameSession } from "./hooks/use-game-session.ts";

interface Props {
	world: World;
	setup?: GameSetup;
}

export function App({ world, setup }: Props) {
	const { messages, streamingText, handleSubmit, isLoading, tokenUsage } = useGameSession(world, setup);

	const isThinking = isLoading && !streamingText;

	return (
		<Box flexDirection="column" gap={1}>
			<Box>
				<Text bold color="magenta">
					🤖 Hi, I'm the Dungeon Master.
				</Text>
				<Text dimColor> (type "quit" to quit)</Text>
			</Box>

			<MessageList messages={messages} />

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
