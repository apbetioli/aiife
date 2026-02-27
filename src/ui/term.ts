import readline from "node:readline";
import { CYAN, RESET } from "./ansi";

export class Terminal {
	private rl: readline.Interface;

	constructor() {
		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
	}

	prompt(prefix = `\n${CYAN}> `): Promise<string> {
		return new Promise((resolve) => {
			this.rl.question(prefix, (answer) => {
				resolve(answer);
			});
		});
	}

	print(text: string): void {
		console.log(RESET + text);
	}

	close(): void {
		this.rl.close();
	}
}
