import * as fs from "node:fs";
import * as path from "node:path";
import type { SaveFile } from "../save";
import { sanitizeSlot } from "../save";
import type { SaveStorageAdapter } from "./types";

export class FileSaveStorage implements SaveStorageAdapter {
	constructor(private baseDir: string = process.cwd()) {}

	private getFilename(worldId: string, slot: string): string {
		return path.join(this.baseDir, `.save-${worldId}-${sanitizeSlot(slot)}.json`);
	}

	save(worldId: string, slot: string, data: SaveFile): void {
		const filename = this.getFilename(worldId, slot);
		fs.writeFileSync(filename, JSON.stringify(data, null, 2), "utf-8");
	}

	load(worldId: string, slot: string): SaveFile | null {
		const filename = this.getFilename(worldId, slot);
		if (!fs.existsSync(filename)) {
			return null;
		}
		const content = fs.readFileSync(filename, "utf-8");
		return JSON.parse(content) as SaveFile;
	}

	exists(worldId: string, slot: string): boolean {
		return fs.existsSync(this.getFilename(worldId, slot));
	}
}
