import { useMemo } from "react";
import { Text } from "ink";
import InkSpinner from "ink-spinner";

const DUNGEON_LABELS = [
	"You wait...",
	"Pondering your life choices...",
	"The darkness is thinking...",
	"Consulting the ancient runes...",
	"Rolling for initiative...",
	"Searching the room (again)...",
	"The dungeon holds its breath...",
	"Checking for traps (in your mind)...",
	"Ruminating in the dark...",
	"Listening to the echoes...",
	"Something moves in the shadows (it's you)...",
	"Counting gold pieces...",
	"The torch flickers...",
	"Wondering what 'xyzzy' does...",
	"Reading the room...",
] as const;

interface SpinnerProps {
	label?: string;
}

export function Spinner({ label }: SpinnerProps) {
	const randomLabel = useMemo(
		() =>
			DUNGEON_LABELS[Math.floor(Math.random() * DUNGEON_LABELS.length)],
		[],
	);
	const resolvedLabel = label ?? randomLabel;
	return (
		<Text>
			<Text color="cyan">
				<InkSpinner type="dots" />
			</Text>{" "}
			<Text dimColor>{resolvedLabel}</Text>
		</Text>
	);
}
