import { Box, Text, useInput } from "ink";
import { useState } from "react";

interface InputProps {
	onSubmit: (value: string) => void;
	disabled?: boolean;
	color?: string;
}

export function Input({
	onSubmit,
	disabled = false,
	color = "gray",
}: InputProps) {
	const [value, setValue] = useState("");

	useInput((input, key) => {
		if (disabled) return;

		if (key.return) {
			if (value.trim()) {
				onSubmit(value);
				setValue("");
			}
			return;
		}

		if (key.backspace || key.delete) {
			setValue((prev) => prev.slice(0, -1));
			return;
		}

		if (input && !key.ctrl && !key.meta) {
			setValue((prev) => prev + input);
		}
	});

	return (
		<Box>
			<Text color={color} bold>
				{`> ${value}`}
			</Text>
			{!disabled && <Text color="gray">▌</Text>}
		</Box>
	);
}
