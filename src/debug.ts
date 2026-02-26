import { TerminalFormatter } from "./ui/TerminalFormatter.js";

export function DEBUG(...args: any[]) {
	const narrator = new TerminalFormatter();

	const format = (text: string) => {
		return narrator.format({
			message: text,
			success: false,
			gameOver: true,
		});
	};

	if (process.env.DEBUG) {
		console.debug(format(`[DEBUG] ${(args ?? []).join(" ")}`));
	}
}
