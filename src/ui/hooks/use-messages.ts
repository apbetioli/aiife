import { useCallback, useState } from "react";
import type { Message } from "../components/MessageList";

export function useMessages(): [Message[], (message: Message) => void] {
	const [messages, setMessages] = useState<Message[]>([]);

	const addMessage = useCallback((message: Message) => {
		setMessages((prev) => [...prev, { ...message, id: crypto.randomUUID() }]);
	}, []);

	return [messages, addMessage] as const;
}
