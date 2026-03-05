import { render } from "ink";
import { resolve } from "node:path";
import React from "react";
import { getModelsDebugInfo } from "./agent/model.ts";
import { App } from "./ui/index.tsx";
import { WorldSchema } from "./world/types.ts";

const DEFAULT_GAME = "the-great-hall";

async function main() {
	if (process.env.DEBUG === "true") {
		console.log(`Models:\n${getModelsDebugInfo()}`);
	}

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
