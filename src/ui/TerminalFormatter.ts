import type { ActionResult } from "../types.js";
import { BOLD, CYAN, DIM, GREEN, RESET, YELLOW } from "./ansi.js";

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

  formatWelcome(text: string): string {
    let formatted = text.replace(/\*\*(.+?)\*\*/g, `${BOLD}$1${RESET}`);
    return `\n${CYAN}${"═".repeat(
      50
    )}${RESET}\n${formatted}\n${CYAN}${"═".repeat(50)}${RESET}\n`;
  }
}
