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
	header?: ReactNode;
}

type StaticItem = { id: string; type: "header" } | { id: string; type: "message"; message: Message };

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

export function MessageList({ messages, header }: MessageListProps) {
	const visibleMessages = messages.filter((message) => message.role !== "tool" || IS_DEBUG);

	const items: StaticItem[] = [
		...(header ? [{ id: "__header__", type: "header" as const }] : []),
		...visibleMessages.map((message, index) => ({
			id: message.id ?? `msg-${index}-${message.content}`,
			type: "message" as const,
			message,
		})),
	];

	return (
		<Static items={items}>
			{(item) => (
				<Box key={item.id} marginBottom={1}>
					{item.type === "header" ? header : renderMessageContent(item.message)}
				</Box>
			)}
		</Static>
	);
}
