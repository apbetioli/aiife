import { DEBUG } from "./debug.js";
import { GameEngine } from "./engine/GameEngine.js";
import { Narrator } from "./ui/Narrator.js";
import { Terminal } from "./ui/Terminal.js";
import { loadWorldFromFile } from "./world/WorldLoader.js";

async function main() {
  const terminal = new Terminal();
  const narrator = new Narrator();

  const definition = loadWorldFromFile();
  const engine = new GameEngine(definition);

  terminal.print(narrator.formatWelcome(engine.getWelcome()));

  while (!engine.getState().gameOver) {
    const input = await terminal.prompt("\n> ");
    const result = await engine.processInput(input);
    terminal.print(narrator.format(result));
  }

  terminal.close();
}

DEBUG("Debug mode enabled");
main();
