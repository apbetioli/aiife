import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ActionPack, GameSetup } from "../engine/rules";
import { type World, WorldSchema } from "./types";

const DEFAULT_GAME = "the-great-hall";
const GAMES_DIR = resolve(import.meta.dirname, "..", "..", "games");

export interface LoadedGame {
	world: World;
	setup?: GameSetup;
	actions?: ActionPack | ActionPack[];
}

export function normalizeGameExport(mod: unknown): LoadedGame {
	if (!mod || typeof mod !== "object") {
		throw new Error("Game module must export an object");
	}

	const exported = (mod as { default?: unknown }).default ?? mod;
	const isBundle = exported && typeof exported === "object" && "world" in exported;
	const bundle = isBundle
		? (exported as { world: unknown; setup?: GameSetup; actions?: ActionPack | ActionPack[] })
		: undefined;
	const named = mod as { setup?: GameSetup; actions?: ActionPack | ActionPack[] };

	return {
		world: WorldSchema.parse(bundle ? bundle.world : exported),
		setup: bundle?.setup ?? (typeof named.setup === "function" ? named.setup : undefined),
		actions: bundle?.actions ?? named.actions,
	};
}

async function loadGame(path: string): Promise<LoadedGame | null> {
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

export async function loadWorld(): Promise<LoadedGame> {
	const gameName = process.argv.slice(2).find((a) => a !== "--") ?? DEFAULT_GAME;
	const pathsToTry = getGamePathsToTry(gameName);

	let result: LoadedGame | null = null;
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

	return result;
}
