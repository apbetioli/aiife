import type { SaveFile } from "../save";
import type { SaveStorageAdapter } from "./types";

export class MemorySaveStorage implements SaveStorageAdapter {
	private saves = new Map<string, SaveFile>();

	private getKey(worldId: string, slot: string): string {
		const sanitizedSlot = slot.replace(/[^a-zA-Z0-9_-]/g, "") || "default";
		return `${worldId}:${sanitizedSlot}`;
	}

	save(worldId: string, slot: string, data: SaveFile): void {
		this.saves.set(this.getKey(worldId, slot), structuredClone(data));
	}

	load(worldId: string, slot: string): SaveFile | null {
		const data = this.saves.get(this.getKey(worldId, slot));
		return data ? structuredClone(data) : null;
	}

	exists(worldId: string, slot: string): boolean {
		return this.saves.has(this.getKey(worldId, slot));
	}
}
