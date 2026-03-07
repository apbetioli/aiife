import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { GameSetup } from "../engine/rules/index.ts";
import { type World, WorldSchema } from "./types.ts";

const DEFAULT_GAME = "the-great-hall";
const GAMES_DIR = resolve(import.meta.dirname, "..", "games");

async function loadGame(path: string): Promise<{ world: unknown; setup?: GameSetup } | null> {
	if (path.endsWith(".json")) {
		const raw = await readFile(path, "utf-8");
		return { world: WorldSchema.parse(JSON.parse(raw)) };
	}
	const mod = await import(path);
	const setup = typeof mod.setup === "function" ? (mod.setup as GameSetup) : undefined;
	return { world: mod.default, setup };
}

export async function loadWorld(): Promise<{ world: World; setup?: GameSetup }> {
	const gameName = process.argv.slice(2).find((a) => a !== "--") ?? DEFAULT_GAME;
	const base = gameName.replace(/\.(tsx?|json)$/, "");
	const pathsToTry = gameName.endsWith(".json")
		? [resolve(GAMES_DIR, gameName)]
		: gameName.endsWith(".ts") || gameName.endsWith(".tsx")
			? [resolve(GAMES_DIR, gameName), resolve(GAMES_DIR, `${base}.json`)]
			: [resolve(GAMES_DIR, `${gameName}.ts`), resolve(GAMES_DIR, `${gameName}.json`)];

	let result: { world: unknown; setup?: GameSetup } | null = null;
	for (const path of pathsToTry) {
		try {
			result = await loadGame(path);
			break;
		} catch {
			// try next path
		}
	}

	if (!result) {
		console.error(`Could not load game "${gameName}" (tried ${pathsToTry.join(", ")})`);
		process.exit(1);
	}

	return { world: WorldSchema.parse(result.world), setup: result.setup };
}
