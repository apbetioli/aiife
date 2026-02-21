import { DEBUG } from "./debug.js";
import { GameEngine } from "./engine/GameEngine.js";
import { Narrator } from "./ui/Narrator.js";
import { Terminal } from "./ui/Terminal.js";
import { loadWorld } from "./world/WorldLoader.js";

async function main() {
  const terminal = new Terminal();
  const narrator = new Narrator();

  const world = loadWorld();
  const engine = new GameEngine(world);

  const intro = world.welcomeMessage.trim();
  terminal.print(narrator.formatWelcome(`${intro}\n\n`));

  while (!engine.getState().gameOver) {
    const input = await terminal.prompt();
    const result = await engine.processInput(input);
    terminal.print(narrator.format(result));
  }

  terminal.close();
}

DEBUG("Debug mode enabled");
main();
