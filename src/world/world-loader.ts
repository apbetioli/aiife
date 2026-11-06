import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { GameSetup } from "../engine/rules";
import { type World, WorldSchema } from "./types";

const DEFAULT_GAME = "the-great-hall";
const GAMES_DIR = resolve(import.meta.dirname, "..", "..", "games");

export function normalizeGameExport(mod: unknown): { world: World; setup?: GameSetup } {
	if (!mod || typeof mod !== "object") {
		throw new Error("Game module must export an object");
	}

	const exported = (mod as { default?: unknown }).default ?? mod;

	// Case 1: Bundled export { world, setup } (e.g. from defineGame)
	if (exported && typeof exported === "object" && "world" in exported) {
		const bundle = exported as { world: unknown; setup?: GameSetup };
		const namedSetup =
			typeof (mod as { setup?: unknown }).setup === "function" ? (mod as { setup: GameSetup }).setup : undefined;
		return {
			world: WorldSchema.parse(bundle.world),
			setup: bundle.setup ?? namedSetup,
		};
	}

	// Case 2: Bare World export + optional named setup
	const namedSetup =
		typeof (mod as { setup?: unknown }).setup === "function" ? (mod as { setup: GameSetup }).setup : undefined;
	return {
		world: WorldSchema.parse(exported),
		setup: namedSetup,
	};
}

async function loadGame(path: string): Promise<{ world: World; setup?: GameSetup } | null> {
	if (path.endsWith(".json")) {
		const raw = await readFile(path, "utf-8");
		return { world: WorldSchema.parse(JSON.parse(raw)) };
	}
	const mod = await import(path);
	return normalizeGameExport(mod);
}

function getGamePathsToTry(gameName: string): string[] {
	const base = gameName.replace(/\.(tsx?|json)$/, "");
	if (gameName.endsWith(".json")) {
		return [resolve(GAMES_DIR, gameName)];
	}
	if (gameName.endsWith(".ts") || gameName.endsWith(".tsx")) {
		return [resolve(GAMES_DIR, gameName), resolve(GAMES_DIR, `${base}.json`)];
	}
	return [resolve(GAMES_DIR, `${gameName}.ts`), resolve(GAMES_DIR, `${gameName}.json`)];
}

export async function loadWorld(): Promise<{ world: World; setup?: GameSetup }> {
	const gameName = process.argv.slice(2).find((a) => a !== "--") ?? DEFAULT_GAME;
	const pathsToTry = getGamePathsToTry(gameName);

	let result: { world: World; setup?: GameSetup } | null = null;
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

	return { world: result.world, setup: result.setup };
}
