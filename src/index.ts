import { GameEngine } from "./engine/GameEngine.js";
import { createParser } from "./parser/LLMProvider.js";
import { loadWorld } from "./world/WorldLoader.js";
import { starterWorld } from "./world/starterWorld.js";
import { Terminal } from "./ui/Terminal.js";
import { Narrator } from "./ui/Narrator.js";

async function main() {
  const terminal = new Terminal();
  const narrator = new Narrator();

  const state = loadWorld(starterWorld);
  const parser = createParser();
  const engine = new GameEngine(state, parser);

  terminal.print(narrator.formatWelcome(engine.getWelcome()));

  while (!state.gameOver) {
    const input = await terminal.prompt("\n> ");
    const result = await engine.processInput(input);
    terminal.print(narrator.format(result));
  }

  terminal.close();
}

main();
