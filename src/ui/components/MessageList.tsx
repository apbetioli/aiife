import { Box, Static } from "ink";
import type { ReactNode } from "react";
import { IS_DEBUG } from "../helpers";
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
	const visibleMessages = messages.filter((message) => message.role !== "tool" || IS_DEBUG);

	return (
		<Static items={visibleMessages}>
			{(message) => (
				<Box key={message.id ?? message.content} marginBottom={1}>
					{renderMessageContent(message)}
				</Box>
			)}
		</Static>
	);
}
