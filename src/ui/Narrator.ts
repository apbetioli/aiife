import type { ActionResult } from "../types.js";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

export class Narrator {
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
    return `\n${CYAN}${"═".repeat(50)}${RESET}\n${formatted}\n${CYAN}${"═".repeat(50)}${RESET}\n`;
  }
}
