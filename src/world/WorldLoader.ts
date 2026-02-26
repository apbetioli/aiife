import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type WorldDefinition, WorldDefinitionSchema } from "../types.js";

const DEMO_WORLD_PATH = "games/demo.json";

export function loadWorld(): { definition: WorldDefinition; filePath: string } {
	const worldPath = process.argv.length > 2 ? process.argv[2] : DEMO_WORLD_PATH;
	const filePath = resolve(worldPath);

	const definition = WorldDefinitionSchema.parse(
		JSON.parse(readFileSync(filePath, "utf-8")),
	);

	return { definition, filePath };
}
