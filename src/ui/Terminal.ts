import readline from "node:readline";

export class Terminal {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  prompt(prefix = "> "): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prefix, (answer) => {
        resolve(answer);
      });
    });
  }

  print(text: string): void {
    console.log(text);
  }

  close(): void {
    this.rl.close();
  }
}
