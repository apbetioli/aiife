import { Box } from "ink";
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
	return (
		<Box flexDirection="column" gap={1}>
			{messages
				.filter((message) => message.role !== "tool" || IS_DEBUG)
				.map((message) => (
					<Box key={message.id}>{renderMessageContent(message)}</Box>
				))}
		</Box>
	);
}
