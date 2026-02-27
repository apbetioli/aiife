import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type World, WorldSchema } from "./types";

const DEMO_WORLD_PATH = "games/demo.json";

export function loadWorld(): { world: World; filePath: string } {
	const worldPath = process.argv.length > 2 ? process.argv[2] : DEMO_WORLD_PATH;
	const filePath = resolve(worldPath);

	const world = WorldSchema.parse(JSON.parse(readFileSync(filePath, "utf-8")));

	return { world, filePath };
}
