import { readFileSync } from "fs";
import { WorldDefinitionSchema } from "../types.js";

const DEMO_WORLD_PATH = "games/demo.json";

export function loadWorld() {
  const worldPath = process.argv.length > 2 ? process.argv[2] : DEMO_WORLD_PATH;

  return WorldDefinitionSchema.parse(
    JSON.parse(readFileSync(worldPath, "utf-8"))
  );
}
