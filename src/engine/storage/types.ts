import type { SaveFile } from "../save";

export interface SaveStorageAdapter {
	save(worldId: string, slot: string, data: SaveFile): void;
	load(worldId: string, slot: string): SaveFile | null;
	exists(worldId: string, slot: string): boolean;
}
