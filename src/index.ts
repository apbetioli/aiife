import { createModel } from "./agent/model.js";
import { GameEngine } from "./engine/GameEngine.js";
import { Terminal } from "./ui/Terminal.js";
import { TerminalFormatter } from "./ui/TerminalFormatter.js";
import { loadWorld } from "./world/WorldLoader.js";

async function main() {
  const terminal = new Terminal();
  const formatter = new TerminalFormatter();

  const world = loadWorld();
  const intro = world.welcomeMessage.trim();
  terminal.print(formatter.formatWelcome(intro));

  const engine = new GameEngine(world, createModel());

  const result = engine.start();
  terminal.print(formatter.format(result));

  while (!engine.getState().gameOver) {
    const input = await terminal.prompt();
    const result = await engine.processInput(input);
    terminal.print(formatter.format(result));
  }

  terminal.close();
}

main();
