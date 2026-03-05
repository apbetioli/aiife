import { resolve } from "node:path";
import { render } from "ink";
import React from "react";
import { App } from "./ui/index.tsx";
import { WorldSchema } from "./world/types.ts";

const DEFAULT_GAME = "the-great-hall";

async function main() {
	const gameName = process.argv.slice(2).find((a) => a !== "--") ?? DEFAULT_GAME;
	const gamePath = resolve(import.meta.dirname, "..", "games", `${gameName}.ts`);

	let mod: Record<string, unknown>;
	try {
		mod = await import(gamePath);
	} catch {
		console.error(`Could not load game "${gameName}" from ${gamePath}`);
		process.exit(1);
	}

	const world = WorldSchema.parse(mod.default);
	render(React.createElement(App, { world }));
}

main();
