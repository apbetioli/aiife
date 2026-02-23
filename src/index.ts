import { createModel } from "./agent/model.js";
import { GameEngine } from "./engine/GameEngine.js";
import { Terminal } from "./ui/Terminal.js";
import { TerminalFormatter } from "./ui/TerminalFormatter.js";
import { loadWorld } from "./world/WorldLoader.js";

async function main() {
  const terminal = new Terminal();
  const formatter = new TerminalFormatter();

  const { definition, filePath } = loadWorld();
  const intro = definition.welcomeMessage.trim();
  terminal.print(formatter.formatWelcome(intro));

  const engine = new GameEngine(definition, createModel(), filePath);

  const result = await engine.start();
  terminal.print(formatter.format(result));

  while (!engine.getState().gameOver) {
    const input = await terminal.prompt();
    const result = await engine.processInput(input);
    terminal.print(formatter.format(result));
  }

  terminal.close();
}

main();
