import { GameEngine } from "./engine/GameEngine.js";
import { createParser } from "./parser/ParserFactory.js";
import { Narrator } from "./ui/Narrator.js";
import { Terminal } from "./ui/Terminal.js";
import { loadWorldFromFile } from "./world/WorldLoader.js";

async function main() {
  const terminal = new Terminal();
  const narrator = new Narrator();

  const state = loadWorldFromFile();

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
