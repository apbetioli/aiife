import { describe, expect, it } from "vitest";
import { makeTestWorld } from "./__fixtures__/test-world";
import { GameEngine } from "./game-engine";
import { buildInitialState } from "./initial-state";
import {
	findStateDifferences,
	load,
	loadSaveFile,
	recreateStateFromHistory,
	replayHistory,
	type SaveFile,
	SCHEMA_VERSION,
	sanitizeSlot,
	save,
	type TurnHistoryEntry,
} from "./save";

describe("save / load", () => {
	it("sanitizeSlot normalizes slot names safely", () => {
		expect(sanitizeSlot()).toBe("default");
		expect(sanitizeSlot("")).toBe("default");
		expect(sanitizeSlot("   ")).toBe("default");
		expect(sanitizeSlot("quick-save_1")).toBe("quick-save_1");
		expect(sanitizeSlot("../../bad/name")).toBe("badname");
		expect(sanitizeSlot("!!!")).toBe("default");
	});

	it("save produces a valid SaveFile with schema version 2 by default", () => {
		const state = buildInitialState(makeTestWorld());
		const file = save(state);

		expect(file.schema_version).toBe(SCHEMA_VERSION);
		expect(file.schema_version).toBe(2);
		expect(file.world_id).toBe("test_world");
		expect(file.saved_at).toBeTruthy();
		expect(file.state).toEqual(state);
		expect(file.history).toEqual([]);
	});

	it("save can produce version 1 save file for backwards compatibility", () => {
		const state = buildInitialState(makeTestWorld());
		const file = save(state, undefined, { version: 1 });

		expect(file.schema_version).toBe(1);
		expect(file.world_id).toBe("test_world");
		expect(file.state).toEqual(state);
		expect(file.history).toBeUndefined();
	});

	it("load supports schema version 1 without history", () => {
		const state = buildInitialState(makeTestWorld());
		const v1File = {
			schema_version: 1,
			saved_at: new Date().toISOString(),
			world_id: "test_world",
			state,
		};

		const restoredState = load(v1File);
		expect(restoredState).toEqual(state);

		const restoredFile = loadSaveFile(v1File);
		expect(restoredFile.schema_version).toBe(1);
		expect(restoredFile.history).toEqual([]);
		expect(restoredFile.state).toEqual(state);
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
		state.objects.gem.location = "inventory";
		state.objects.door.state.locked = false;
		state.rooms.room_a.state.visited = true;

		const file = save(state);
		const json = JSON.parse(JSON.stringify(file));
		const restored = load(json);

		expect(restored).toEqual(state);
		expect(restored.turn).toBe(5);
		expect(restored.player.current_room).toBe("room_b");
		expect(restored.objects.door.state.locked).toBe(false);
		expect(restored.rooms.room_a.state.visited).toBe(true);
	});

	it("persists command history in SaveFile", () => {
		const state = buildInitialState(makeTestWorld());
		const history: TurnHistoryEntry[] = [
			{
				turn: 1,
				input: "take lantern",
				output: "Taken.",
				intent: { action: "take", objects: ["lamp"] },
				state: structuredClone(state),
				timestamp: new Date().toISOString(),
			},
			{
				turn: 2,
				input: "go south",
				output: "You walk south.",
				intent: { action: "go", direction: "south" },
				state: structuredClone(state),
				timestamp: new Date().toISOString(),
			},
		];

		const file = save(state, history);
		expect(file.history).toHaveLength(2);
		expect(file.history?.[0].input).toBe("take lantern");
		expect(file.history?.[1].intent?.direction).toBe("south");

		const json = JSON.parse(JSON.stringify(file));
		const loadedFile = loadSaveFile(json);
		expect(loadedFile.history).toHaveLength(2);
		expect(loadedFile.history?.[0].turn).toBe(1);
		expect(loadedFile.history?.[1].output).toBe("You walk south.");
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

describe("GameEngine command history tracking", () => {
	it("records turn command history during gameplay", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		expect(engine.getCommandHistory()).toHaveLength(0);

		const takeRes = engine.runAction({ action: "take", objects: ["lamp"] });
		expect(takeRes).toBe("Taken.");

		const history = engine.getCommandHistory();
		expect(history).toHaveLength(1);
		expect(history[0].turn).toBe(1);
		expect(history[0].intent).toEqual({ action: "take", objects: ["lamp"] });
		expect(history[0].output).toBe("Taken.");
		expect(history[0].state?.objects.lamp.location).toBe("inventory");
		expect(history[0].timestamp).toBeTruthy();
	});

	it("preserves custom rawInput and updates via updateLastCommand", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "take", objects: ["lamp"] }, { rawInput: "pick up brass lantern" });

		let history = engine.getCommandHistory();
		expect(history[0].input).toBe("pick up brass lantern");

		engine.updateLastCommand({
			output: "You pick up the brass lantern.",
			tool_calls: [{ toolName: "take", args: { objects: ["lamp"] } }],
		});

		history = engine.getCommandHistory();
		expect(history[0].output).toBe("You pick up the brass lantern.");
		expect(history[0].tool_calls).toHaveLength(1);
		expect(history[0].tool_calls?.[0].toolName).toBe("take");
	});

	it("records stopped or invalid actions in command history", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		const res = engine.runAction({ action: "take", objects: ["nonexistent"] }, { rawInput: "take nonexistent" });
		expect(res).toBe("You don't see that here.");

		const history = engine.getCommandHistory();
		expect(history).toHaveLength(1);
		expect(history[0].input).toBe("take nonexistent");
		expect(history[0].output).toBe("You don't see that here.");
	});

	it("save and restore cycle preserves command history", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "take", objects: ["lamp"] }, { rawInput: "take lamp" });
		engine.runAction({ action: "go", direction: "south" }, { rawInput: "south" });

		const saveFile = engine.save();
		expect(saveFile.history).toHaveLength(2);

		const engine2 = new GameEngine(world);
		engine2.start();
		expect(engine2.getCommandHistory()).toHaveLength(0);

		engine2.restore(saveFile);
		expect(engine2.getState().player.current_room).toBe("room_b");
		expect(engine2.getCommandHistory()).toHaveLength(2);
		expect(engine2.getCommandHistory()[0].input).toBe("take lamp");
		expect(engine2.getCommandHistory()[1].input).toBe("south");
	});

	it("restart clears command history", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "take", objects: ["lamp"] });
		expect(engine.getCommandHistory()).toHaveLength(1);

		engine.restart();
		expect(engine.getCommandHistory()).toHaveLength(0);
	});

	it("undo records undo in command history and reverts game state", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "take", objects: ["lamp"] }, { rawInput: "take lamp" });
		expect(engine.getState().objects.lamp.location).toBe("inventory");

		engine.runAction({ action: "undo" }, { rawInput: "undo" });
		expect(engine.getState().objects.lamp.location).toBe("room_a");

		const history = engine.getCommandHistory();
		expect(history).toHaveLength(2);
		expect(history[0].input).toBe("take lamp");
		expect(history[1].input).toBe("undo");
		expect(history[1].state?.objects.lamp.location).toBe("room_a");
	});
});

describe("recreateStateFromHistory & replayHistory", () => {
	it("recreates state faithfully from turn history", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "take", objects: ["lamp"] });
		engine.runAction({ action: "go", direction: "south" });

		const expectedState = engine.getState();
		const history = engine.getCommandHistory();

		const reconstructed = recreateStateFromHistory(world, history);

		expect(reconstructed.turn).toBe(expectedState.turn);
		expect(reconstructed.player.current_room).toBe("room_b");
		expect(reconstructed.objects.lamp.location).toBe("inventory");
		expect(reconstructed.rooms.room_b.state.visited).toBe(true);
		expect(reconstructed).toEqual(expectedState);
	});

	it("replayHistory verifies state fidelity and returns matchesSavedState: true", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "take", objects: ["lamp"] }, { rawInput: "take lamp" });
		engine.runAction({ action: "go", direction: "south" }, { rawInput: "go south" });

		const saveFile = engine.save();
		const result = replayHistory(world, saveFile);

		expect(result.matchesSavedState).toBe(true);
		expect(result.turnsExecuted).toBe(2);
		expect(result.mismatches).toHaveLength(0);
		expect(result.outputs).toHaveLength(2);
		expect(result.finalState.player.current_room).toBe("room_b");
		expect(result.finalState.objects.lamp.location).toBe("inventory");
	});

	it("replayHistory handles history with undo actions", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "take", objects: ["lamp"] });
		engine.runAction({ action: "go", direction: "south" });
		engine.runAction({ action: "undo" });

		const saveFile = engine.save();
		const result = replayHistory(world, saveFile);

		expect(result.matchesSavedState).toBe(true);
		expect(result.finalState.player.current_room).toBe("room_a");
		expect(result.finalState.objects.lamp.location).toBe("inventory");
		expect(result.turnsExecuted).toBe(3);
	});

	it("replayHistory detects state mismatches if snapshot state was corrupted", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "take", objects: ["lamp"] });
		const history = engine.getCommandHistory();

		// Tamper with the snapshot state to simulate mismatch
		if (history[0].state) {
			history[0].state.player.current_room = "nonexistent_room";
		}

		const result = replayHistory(world, history);
		expect(result.matchesSavedState).toBe(false);
		expect(result.mismatches).toHaveLength(1);
		expect(result.mismatches[0].differences.length).toBeGreaterThan(0);
		expect(result.mismatches[0].differences[0]).toContain("player.current_room");
	});

	it("recreates state when history entries only contain tool_calls", () => {
		const world = makeTestWorld();
		const history: TurnHistoryEntry[] = [
			{
				turn: 1,
				input: "take lamp",
				output: "Taken.",
				tool_calls: [{ toolName: "take", args: { objects: ["lamp"] } }],
			},
			{
				turn: 2,
				input: "go south",
				output: "You walk south.",
				tool_calls: [{ toolName: "go", args: { direction: "south" } }],
			},
		];

		const reconstructed = recreateStateFromHistory(world, history);
		expect(reconstructed.player.current_room).toBe("room_b");
		expect(reconstructed.objects.lamp.location).toBe("inventory");
		expect(reconstructed.turn).toBe(2);
	});

	it("recreates state when history entries only contain raw command inputs", () => {
		const world = makeTestWorld();
		const history: TurnHistoryEntry[] = [
			{
				turn: 1,
				input: "south",
				output: "You walk south.",
			},
			{
				turn: 2,
				input: "look",
				output: "You are in room B.",
			},
		];

		const reconstructed = recreateStateFromHistory(world, history);
		expect(reconstructed.player.current_room).toBe("room_b");
		expect(reconstructed.turn).toBe(2);
	});

	it("GameEngine.recreateFromHistory and GameEngine.replayHistory helpers work seamlessly", () => {
		const world = makeTestWorld();
		const engine = new GameEngine(world);
		engine.start();

		engine.runAction({ action: "take", objects: ["lamp"] });
		engine.runAction({ action: "go", direction: "south" });

		const reconstructed = engine.recreateFromHistory();
		expect(reconstructed.player.current_room).toBe("room_b");
		expect(reconstructed.objects.lamp.location).toBe("inventory");

		const replayRes = engine.replayHistory();
		expect(replayRes.matchesSavedState).toBe(true);
		expect(replayRes.turnsExecuted).toBe(2);
	});

	it("findStateDifferences identifies mismatches across rooms, objects, and turns", () => {
		const state1 = buildInitialState(makeTestWorld());
		const state2 = structuredClone(state1);

		state2.turn = 10;
		state2.player.current_room = "room_b";
		state2.objects.lamp.location = "inventory";
		state2.rooms.room_b.state.visited = true;

		const diffs = findStateDifferences(state1, state2);
		expect(diffs).toHaveLength(4);
		expect(diffs.some((d) => d.includes("turn"))).toBe(true);
		expect(diffs.some((d) => d.includes("player.current_room"))).toBe(true);
		expect(diffs.some((d) => d.includes("lamp"))).toBe(true);
		expect(diffs.some((d) => d.includes("room_b"))).toBe(true);
	});
});
