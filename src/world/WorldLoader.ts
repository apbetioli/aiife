import { readFileSync } from "fs";
import { resolve } from "path";
import type { WorldDefinition } from "../types.js";

export function loadWorldFromFile(): WorldDefinition {
  const worldArg = process.argv.find((a) => a.startsWith("--world="));
  const worldPath = worldArg
    ? worldArg.slice("--world=".length)
    : "games/demo.json";

  try {
    const absPath = resolve(worldPath);
    let raw: string;
    try {
      raw = readFileSync(absPath, "utf-8");
    } catch {
      throw new Error(`Could not read world file: ${absPath}`);
    }

    try {
      return JSON.parse(raw) as WorldDefinition;
    } catch {
      throw new Error(`Invalid JSON in world file: ${absPath}`);
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
