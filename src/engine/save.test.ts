import { describe, expect, it } from "vitest";
import { makeTestWorld } from "./__fixtures__/test-world";
import { buildInitialState } from "./initial-state";
import { load, type SaveFile, save } from "./save";

describe("save / load", () => {
	it("save produces a valid SaveFile", () => {
		const state = buildInitialState(makeTestWorld());
		const file = save(state);

		expect(file.schema_version).toBe(1);
		expect(file.world_id).toBe("test_world");
		expect(file.saved_at).toBeTruthy();
		expect(file.state).toEqual(state);
	});

	it("round-trip produces identical state", () => {
		const state = buildInitialState(makeTestWorld());
		const file = save(state);
		const json = JSON.parse(JSON.stringify(file));
		const restored = load(json);

		expect(restored).toEqual(state);
	});

	it("round-trip preserves mutated state", () => {
		const state = buildInitialState(makeTestWorld());
		state.turn = 5;
		state.player.current_room = "room_b";
		state.player.inventory = ["sword", "gem"];
		state.objects.door.flags.locked = false;
		state.rooms.room_a.flags.visited = true;

		const file = save(state);
		const json = JSON.parse(JSON.stringify(file));
		const restored = load(json);

		expect(restored).toEqual(state);
		expect(restored.turn).toBe(5);
		expect(restored.player.current_room).toBe("room_b");
		expect(restored.objects.door.flags.locked).toBe(false);
		expect(restored.rooms.room_a.flags.visited).toBe(true);
	});

	it("load throws on invalid save file", () => {
		expect(() => load({})).toThrow("Invalid save file");
		expect(() => load(null)).toThrow("Invalid save file");
		expect(() => load("not json")).toThrow("Invalid save file");
	});

	it("load throws on unsupported schema version", () => {
		const state = buildInitialState(makeTestWorld());
		const file = save(state);
		const json = JSON.parse(JSON.stringify(file)) as SaveFile;
		json.schema_version = 999;

		expect(() => load(json)).toThrow("Unsupported save file version: 999");
	});

	it("saved_at is a valid ISO datetime", () => {
		const state = buildInitialState(makeTestWorld());
		const file = save(state);

		expect(() => new Date(file.saved_at)).not.toThrow();
		expect(new Date(file.saved_at).toISOString()).toBe(file.saved_at);
	});
});
