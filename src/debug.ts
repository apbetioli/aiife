import { YELLOW } from "./ui/ansi";
import { TerminalFormatter } from "./ui/term-formatter";

export function DEBUG(...args: unknown[]) {
	const narrator = new TerminalFormatter();

	const format = (text: string) => {
		return narrator.formatWelcome(
			narrator.format({ message: text, success: false, gameOver: true }),
			YELLOW,
		);
	};

	if (process.env.DEBUG) {
		console.error(format(`[DEBUG] ${(args ?? []).join(" ")}`));
	}
}
