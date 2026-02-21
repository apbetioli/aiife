import { readFileSync } from "fs";
import { WorldDefinitionSchema } from "../types.js";

export function loadWorld() {
  const worldArg = process.argv.find((a) => a.startsWith("--world="));
  const worldPath = worldArg
    ? worldArg.slice("--world=".length)
    : "games/demo.json";

  return WorldDefinitionSchema.parse(
    JSON.parse(readFileSync(worldPath, "utf-8")),
  );
}
