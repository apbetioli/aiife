import type { ActionResult } from "../agent/types";
import { BOLD, CYAN, DIM, GREEN, RESET, YELLOW } from "./ansi";

export class TerminalFormatter {
	format(result: ActionResult): string {
		let text = result.message;
		text = text.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`);

		if (result.isVictory) {
			return `\n${GREEN}${text}${RESET}\n`;
		}

		if (result.gameOver) {
			return `\n${YELLOW}${text}${RESET}\n`;
		}

		if (!result.success) {
			return `${DIM}${text}${RESET}`;
		}

		return text;
	}

	formatWelcome(text: string, color: string = CYAN): string {
		const formatted = text.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`);
		return `\n${color}${"═".repeat(
			50,
		)}${RESET}\n${formatted}\n${color}${"═".repeat(50)}${RESET}\n`;
	}
}
