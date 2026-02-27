import { describe, expect, it } from "vitest";
import { makeTestWorld } from "./__fixtures__/test-world";
import { buildInitialState } from "./initial-state";

describe("buildInitialState", () => {
	// ─── Happy path ──────────────────────────────────────────────────────────

	it("builds a valid game state from a valid world", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);

		expect(state.world_id).toBe("test_world");
		expect(state.version).toBe("1.0.0");
		expect(state.turn).toBe(0);
	});

	it("initialises room states with visited flags and contains lists", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);

		expect(state.rooms.room_a).toEqual({
			visited: false,
			contains: ["door", "lamp", "chest"],
		});
		expect(state.rooms.room_b).toEqual({
			visited: false,
			contains: ["table"],
		});
	});

	it("initialises object states with location and state flags", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);

		expect(state.objects.door).toEqual({
			location: "room_a",
			locked: true,
			open: false,
		});
		expect(state.objects.lamp).toEqual({
			location: "room_a",
			lit: false,
		});
	});

	it("includes contains list for container objects", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);

		expect(state.objects.chest.contains).toEqual(["gem"]);
	});

	it("omits contains for non-container objects", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);

		expect(state.objects.lamp.contains).toBeUndefined();
	});

	it("initialises player state from world definition", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);

		expect(state.player.current_room).toBe("room_a");
		expect(state.player.inventory).toEqual(["sword"]);
		expect(state.player.state).toEqual({ moves: 0 });
	});

	it("copies arrays by value, not by reference", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);

		state.rooms.room_a.contains.push("new_item");
		expect(world.rooms.room_a.contains).not.toContain("new_item");

		state.player.inventory.push("new_weapon");
		expect(world.player.inventory).not.toContain("new_weapon");
	});

	// ─── Validation: object locations ────────────────────────────────────────

	it("rejects objects with invalid locations", () => {
		const world = makeTestWorld({
			objects: {
				...makeTestWorld().objects,
				ghost: {
					id: "ghost",
					name: "ghost",
					synonyms: [],
					type: "npc",
					location: "nonexistent_room",
					carriable: false,
					state: {},
					descriptions: { default: "A ghost." },
				},
			},
		});

		expect(() => buildInitialState(world)).toThrow(
			'Object "ghost" has invalid location "nonexistent_room"',
		);
	});

	// ─── Validation: containment consistency ─────────────────────────────────

	it("rejects rooms listing unknown objects in contains", () => {
		const world = makeTestWorld();
		world.rooms.room_a.contains = [
			...world.rooms.room_a.contains,
			"nonexistent",
		];

		expect(() => buildInitialState(world)).toThrow(
			'Room "room_a" contains unknown object "nonexistent"',
		);
	});

	it("rejects rooms where contains and object.location disagree", () => {
		const world = makeTestWorld();
		// room_a claims it contains "table" but table.location is "room_b"
		world.rooms.room_a.contains = [...world.rooms.room_a.contains, "table"];

		expect(() => buildInitialState(world)).toThrow(
			'Room "room_a" lists "table" in contains, but object.location is "room_b"',
		);
	});

	it("rejects containers listing unknown objects", () => {
		const world = makeTestWorld();
		world.objects.chest.contains = ["nonexistent"];

		expect(() => buildInitialState(world)).toThrow(
			'Object "chest" contains unknown object "nonexistent"',
		);
	});

	// ─── Validation: player inventory ────────────────────────────────────────

	it("rejects inventory referencing unknown objects", () => {
		const world = makeTestWorld();
		world.player.inventory = ["nonexistent"];

		expect(() => buildInitialState(world)).toThrow(
			'Player inventory references unknown object "nonexistent"',
		);
	});

	it("rejects inventory where object.location is not player_inventory", () => {
		const world = makeTestWorld();
		// lamp is in room_a, not player_inventory
		world.player.inventory = ["sword", "lamp"];

		expect(() => buildInitialState(world)).toThrow(
			'Player inventory lists "lamp", but object.location is "room_a"',
		);
	});

	// ─── Validation: exit conditions ─────────────────────────────────────────

	it("rejects exits with unparseable conditions", () => {
		const world = makeTestWorld();
		world.rooms.room_a.exits.north = {
			leads_to: "room_b",
			condition: "this is not valid",
			locked_message: "nope",
		};

		expect(() => buildInitialState(world)).toThrow(
			'unparseable condition: "this is not valid"',
		);
	});

	it("rejects exits referencing unknown objects in conditions", () => {
		const world = makeTestWorld();
		world.rooms.room_a.exits.north = {
			leads_to: "room_b",
			condition: "phantom.open == true",
			locked_message: "nope",
		};

		expect(() => buildInitialState(world)).toThrow(
			'condition references unknown object "phantom"',
		);
	});

	it("rejects exits leading to unknown rooms", () => {
		const world = makeTestWorld();
		world.rooms.room_a.exits.north = {
			leads_to: "void",
			condition: "door.open == true",
			locked_message: "nope",
		};

		expect(() => buildInitialState(world)).toThrow(
			'leads_to unknown room "void"',
		);
	});
});
