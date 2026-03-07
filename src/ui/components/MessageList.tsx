import { Box } from "ink";
import type { ReactNode } from "react";
import Text from "./Text";

export interface Message {
	id?: string;
	role: "user" | "assistant" | "tool";
	content: string;
}

interface MessageListProps {
	messages: Message[];
}

function renderMessageContent(message: Message): ReactNode {
	switch (message.role) {
		case "user":
			return (
				<Text color="blue" bold>
					› {message.content}
				</Text>
			);
		case "assistant":
			return <Text>{message.content}</Text>;
		case "tool":
			return (
				<Text color="green" dimColor>
					⚡{message.content}
				</Text>
			);
	}
}

export function MessageList({ messages }: MessageListProps) {
	return (
		<Box flexDirection="column" gap={1}>
			{messages.map((message) => (
				<Box key={message.id} flexDirection="column">
					{renderMessageContent(message)}
				</Box>
			))}
		</Box>
	);
}
