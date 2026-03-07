import { Box } from "ink";
import Text from "./Text";

export interface Message {
	id?: string;
	role: "user" | "assistant" | "tool";
	content: string;
}

interface MessageListProps {
	messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
	return (
		<Box flexDirection="column" gap={1}>
			{messages.map((message) => (
				<Box key={message.id} flexDirection="column">
					{message.role === "user" && (
						<Text color="blue" bold>
							› {message.content}
						</Text>
					)}
					{message.role === "assistant" && <Text>{message.content}</Text>}
					{message.role === "tool" && (
						<Text color="green" dimColor>
							⚡{message.content}
						</Text>
					)}
				</Box>
			))}
		</Box>
	);
}
