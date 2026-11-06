import { Box, Text, useInput } from "ink";
import { useState } from "react";

interface InputProps {
	onSubmit: (value: string) => void;
	disabled?: boolean;
	color?: string;
}

export function Input({ onSubmit, disabled = false, color = "gray" }: InputProps) {
	const [value, setValue] = useState("");
	const [cursor, setCursor] = useState(0);
	const [history, setHistory] = useState<string[]>([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [savedDraft, setSavedDraft] = useState("");

	useInput((input, key) => {
		if (disabled) return;

		if (key.return) {
			const trimmed = value.trim();
			if (trimmed) {
				setHistory((prev) => [...prev, trimmed]);
				onSubmit(trimmed);
				setValue("");
				setCursor(0);
				setHistoryIndex(-1);
				setSavedDraft("");
			}
			return;
		}

		if (key.upArrow) {
			if (history.length === 0) return;
			if (historyIndex === -1) {
				setSavedDraft(value);
				const nextIndex = history.length - 1;
				setHistoryIndex(nextIndex);
				const nextValue = history[nextIndex];
				setValue(nextValue);
				setCursor(nextValue.length);
			} else if (historyIndex > 0) {
				const nextIndex = historyIndex - 1;
				setHistoryIndex(nextIndex);
				const nextValue = history[nextIndex];
				setValue(nextValue);
				setCursor(nextValue.length);
			}
			return;
		}

		if (key.downArrow) {
			if (historyIndex === -1) return;
			if (historyIndex < history.length - 1) {
				const nextIndex = historyIndex + 1;
				setHistoryIndex(nextIndex);
				const nextValue = history[nextIndex];
				setValue(nextValue);
				setCursor(nextValue.length);
			} else {
				setHistoryIndex(-1);
				setValue(savedDraft);
				setCursor(savedDraft.length);
			}
			return;
		}

		if (key.leftArrow) {
			setCursor((prev) => Math.max(0, prev - 1));
			return;
		}

		if (key.rightArrow) {
			setCursor((prev) => Math.min(value.length, prev + 1));
			return;
		}

		if (key.ctrl && input === "a") {
			setCursor(0);
			return;
		}

		if (key.ctrl && input === "e") {
			setCursor(value.length);
			return;
		}

		if (key.backspace) {
			if (cursor > 0) {
				setValue((prev) => prev.slice(0, cursor - 1) + prev.slice(cursor));
				setCursor((prev) => prev - 1);
			}
			return;
		}

		if (key.delete) {
			if (cursor < value.length) {
				setValue((prev) => prev.slice(0, cursor) + prev.slice(cursor + 1));
			}
			return;
		}

		if (input && !key.ctrl && !key.meta) {
			setValue((prev) => prev.slice(0, cursor) + input + prev.slice(cursor));
			setCursor((prev) => prev + input.length);
		}
	});

	const renderInput = () => {
		if (disabled) {
			return (
				<Text color={color} bold>
					{`> ${value}`}
				</Text>
			);
		}

		if (cursor >= value.length) {
			return (
				<>
					<Text color={color} bold>
						{`> ${value}`}
					</Text>
					<Text color="gray">▌</Text>
				</>
			);
		}

		const before = value.slice(0, cursor);
		const cursorChar = value[cursor] ?? " ";
		const after = value.slice(cursor + 1);

		return (
			<>
				<Text color={color} bold>
					{`> ${before}`}
				</Text>
				<Text inverse>{cursorChar}</Text>
				<Text color={color} bold>
					{after}
				</Text>
			</>
		);
	};

	return <Box>{renderInput()}</Box>;
}
