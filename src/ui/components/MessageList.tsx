import { Box } from "ink";
import Text from "./Text";

export interface Message {
	role: "user" | "assistant";
	content: string;
}

interface MessageListProps {
	messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
	return (
		<Box flexDirection="column" gap={1}>
			{messages.map((message) => (
				<Box key={message.content.slice(0, 10)} flexDirection="column">
					{message.role === "user" && (
						<Text color="blue" bold>
							› {message.content}
						</Text>
					)}
					{message.role === "assistant" && (
						<Box marginLeft={2}>
							<Text>{message.content}</Text>
						</Box>
					)}
				</Box>
			))}
		</Box>
	);
}
