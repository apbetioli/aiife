import theGreatHall from "../games/the-great-hall";
import { GameEngine } from "./engine/game-engine";
import { Terminal } from "./ui/term";
import { TerminalFormatter } from "./ui/term-formatter";
import type { World } from "./world/types";

async function run(world: World) {
	const terminal = new Terminal();
	const formatter = new TerminalFormatter();

	// const intro = world.welcomeMessage.trim();
	// terminal.print(formatter.formatWelcome(intro));

	const engine = new GameEngine(world);

	while (!engine.isGameOver()) {
		const input = await terminal.prompt();
		const result = await engine.processInput(input);
		terminal.print(formatter.format(result));
	}

	terminal.close();
}

run(theGreatHall);
// run(theForgottenManor);
