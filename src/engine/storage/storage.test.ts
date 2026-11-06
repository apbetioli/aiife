import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTestWorld } from "../__fixtures__/test-world";
import { buildInitialState } from "../initial-state";
import { save } from "../save";
import { FileSaveStorage } from "./file-storage";
import { MemorySaveStorage } from "./memory-storage";

describe("Storage Adapters", () => {
	const world = makeTestWorld();
	const state = buildInitialState(world);
	const saveFile = save(state);

	describe("MemorySaveStorage", () => {
		it("saves, loads, and checks existence in memory", () => {
			const storage = new MemorySaveStorage();

			expect(storage.exists("test_world", "slot1")).toBe(false);
			expect(storage.load("test_world", "slot1")).toBeNull();

			storage.save("test_world", "slot1", saveFile);

			expect(storage.exists("test_world", "slot1")).toBe(true);
			const loaded = storage.load("test_world", "slot1");
			expect(loaded).toEqual(saveFile);
		});
	});

	describe("FileSaveStorage", () => {
		let tempDir: string;

		beforeEach(() => {
			tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiife-test-"));
		});

		afterEach(() => {
			fs.rmSync(tempDir, { recursive: true, force: true });
		});

		it("saves, loads, and checks existence on disk in isolated directory", () => {
			const storage = new FileSaveStorage(tempDir);

			expect(storage.exists("test_world", "slot1")).toBe(false);
			expect(storage.load("test_world", "slot1")).toBeNull();

			storage.save("test_world", "slot1", saveFile);

			expect(storage.exists("test_world", "slot1")).toBe(true);
			const loaded = storage.load("test_world", "slot1");
			expect(loaded).toEqual(saveFile);
		});
	});
});
