import { describe, expect, it } from "vitest";
import theForgottenManor from "../../games/the-forgotten-manor";
import theGreatHall from "../../games/the-great-hall";
import { makeTestWorld } from "./__fixtures__/test-world";
import {
	buildInitialState,
	validateAllObjectsOwned,
	validateContainment,
	validateExitConditions,
} from "./initial-state";

describe("buildInitialState", () => {
	// ─── World integrity validators (Phase 1.2) ───────────────────────────────

	describe("validateAllObjectsOwned", () => {
		it("returns empty for valid world", () => {
			expect(validateAllObjectsOwned(makeTestWorld())).toEqual([]);
		});
		it("returns error for orphaned object", () => {
			const world = makeTestWorld({
				objects: {
					...makeTestWorld().objects,
					ghost: {
						id: "ghost",
						name: "ghost",
						synonyms: [],
						type: "npc",
						carriable: false,
						state: {},
						descriptions: { default: "A ghost." },
					},
				},
			});
			expect(validateAllObjectsOwned(world)).toContainEqual(
				expect.stringContaining('"ghost" is not in any room'),
			);
		});
		it("returns error for double-owned object", () => {
			const world = makeTestWorld();
			world.rooms.room_a.contains = [...world.rooms.room_a.contains, "table"];
			expect(validateAllObjectsOwned(world)).toContainEqual(
				expect.stringMatching(/Object "table" is in room.*but also in/),
			);
		});
	});

	describe("validateContainment", () => {
		it("returns empty for valid world", () => {
			expect(validateContainment(makeTestWorld())).toEqual([]);
		});
		it("returns error for room containing unknown object", () => {
			const world = makeTestWorld();
			world.rooms.room_a.contains = [...world.rooms.room_a.contains, "nonexistent"];
			expect(validateContainment(world)).toContainEqual(
				'Room "room_a" contains unknown object "nonexistent"',
			);
		});
		it("returns error for container containing unknown object", () => {
			const world = makeTestWorld();
			world.objects.chest.contains = ["nonexistent"];
			expect(validateContainment(world)).toContainEqual(
				'Object "chest" contains unknown object "nonexistent"',
			);
		});
		it("returns error for player inventory referencing unknown object", () => {
			const world = makeTestWorld();
			world.player.inventory = ["nonexistent"];
			expect(validateContainment(world)).toContainEqual(
				'Player inventory references unknown object "nonexistent"',
			);
		});
	});

	describe("validateExitConditions", () => {
		it("returns empty for valid world", () => {
			expect(validateExitConditions(makeTestWorld())).toEqual([]);
		});
		it("returns error for condition referencing unknown object", () => {
			const world = makeTestWorld();
			world.rooms.room_a.exits.north = {
				leads_to: "room_b",
				condition: "phantom.open == true",
				locked_message: "nope",
			};
			expect(validateExitConditions(world)).toContainEqual(
				expect.stringContaining('unknown object "phantom"'),
			);
		});
		it("returns error for leads_to unknown room", () => {
			const world = makeTestWorld();
			world.rooms.room_a.exits.north = {
				leads_to: "void",
				condition: "door.open == true",
				locked_message: "nope",
			};
			expect(validateExitConditions(world)).toContainEqual(
				expect.stringContaining('unknown room "void"'),
			);
		});
	});

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
			contains: ["door", "lamp", "chest"],
			flags: { visited: false },
		});
		expect(state.rooms.room_b).toEqual({
			contains: ["table"],
			flags: { visited: false },
		});
	});

	it("initialises object states with state flags", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);

		expect(state.objects.door).toEqual({
			flags: { locked: true, open: false },
		});
		expect(state.objects.lamp).toEqual({
			flags: { lit: false },
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

	// ─── Validation: object placement ────────────────────────────────────────

	it("rejects object not in any room, container, or inventory", () => {
		const world = makeTestWorld({
			objects: {
				...makeTestWorld().objects,
				ghost: {
					id: "ghost",
					name: "ghost",
					synonyms: [],
					type: "npc",
					carriable: false,
					state: {},
					descriptions: { default: "A ghost." },
				},
			},
		});
		// ghost is not in any room.contains, any object.contains, or player.inventory
		expect(() => buildInitialState(world)).toThrow(
			'Object "ghost" is not in any room, container, or player inventory',
		);
	});

	// ─── Validation: containment consistency ─────────────────────────────────

	it("rejects room listing object that is already in another room", () => {
		const world = makeTestWorld();
		// table is in room_b; also add to room_a
		world.rooms.room_a.contains = [...world.rooms.room_a.contains, "table"];

		expect(() => buildInitialState(world)).toThrow(
			/Object "table" is in room.*but also in/,
		);
	});

	it("rejects containers listing unknown objects", () => {
		const world = makeTestWorld();
		world.objects.chest.contains = ["nonexistent"];

		expect(() => buildInitialState(world)).toThrow(
			'Object "chest" contains unknown object "nonexistent"',
		);
	});

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

	// ─── Validation: player inventory ────────────────────────────────────────

	it("rejects inventory referencing unknown objects", () => {
		const world = makeTestWorld();
		world.player.inventory = ["nonexistent"];

		expect(() => buildInitialState(world)).toThrow(
			'Player inventory references unknown object "nonexistent"',
		);
	});

	it("rejects inventory when object is also in a room", () => {
		const world = makeTestWorld();
		// lamp is in room_a; add to inventory too
		world.player.inventory = ["sword", "lamp"];

		expect(() => buildInitialState(world)).toThrow(
			/Object "lamp" is in player inventory but also in/,
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

	// ─── The Great Hall ───────────────────────────────────────────────────────

	describe("The Great Hall", () => {
		it("builds valid initial state from world", () => {
			const state = buildInitialState(theGreatHall);

			console.log(state);

			expect(state.world_id).toBe("the_great_hall");
			expect(state.version).toBe("1.0.0");
			expect(state.turn).toBe(0);
			expect(state.player.current_room).toBe("great_hall");
			expect(state.player.inventory).toEqual([]);
		});

		it("initialises all rooms with visited false and correct contains", () => {
			const state = buildInitialState(theGreatHall);

			expect(state.rooms.great_hall).toEqual({
				contains: ["brass_lantern", "cellar_door"],
				flags: { visited: false },
			});
			expect(state.rooms.garden.contains).toEqual(["gardener"]);
			expect(state.rooms.library.contains).toEqual(["old_book", "alcove"]);
			expect(state.rooms.tower_room.contains).toEqual(["wooden_chest"]);
			expect(state.rooms.cellar.contains).toEqual(["stone_pedestal"]);
		});

		it("initialises objects with state", () => {
			const state = buildInitialState(theGreatHall);

			expect(state.objects.cellar_door).toEqual({
				flags: { open: false },
			});
			expect(state.objects.wooden_chest).toEqual({
				flags: { open: false },
				contains: ["gold_amulet"],
			});
			expect(state.objects.alcove).toEqual({
				flags: { revealed: false },
				contains: ["rusty_key"],
			});
		});

		it("omits contains for non-container objects", () => {
			const state = buildInitialState(theGreatHall);

			expect(state.objects.brass_lantern.contains).toBeUndefined();
			expect(state.objects.gardener.contains).toBeUndefined();
		});
	});

	// ─── The Forgotten Manor ──────────────────────────────────────────────────

	describe("The Forgotten Manor", () => {
		it("builds valid initial state from world", () => {
			const state = buildInitialState(theForgottenManor);

			expect(state.world_id).toBe("forgotten_manor");
			expect(state.version).toBe("1.0.0");
			expect(state.turn).toBe(0);
			expect(state.player.current_room).toBe("entrance_hall");
			expect(state.player.inventory).toEqual([]);
			expect(state.player.state).toEqual({ moves: 0, won: false });
		});

		it("initialises all rooms with visited false and correct contains", () => {
			const state = buildInitialState(theForgottenManor);

			expect(state.rooms.entrance_hall).toEqual({
				contains: ["painting", "library_door", "compartment"],
				flags: { visited: false },
			});
			expect(state.rooms.library.contains).toEqual([
				"journal",
				"study_door",
				"bookshelf",
			]);
			expect(state.rooms.garden.contains).toEqual(["stone_bench", "fountain"]);
			expect(state.rooms.study.contains).toEqual(["oak_desk", "candle"]);
		});

		it("initialises objects with state", () => {
			const state = buildInitialState(theForgottenManor);

			expect(state.objects.library_door).toEqual({
				flags: { locked: true, open: false },
			});
			expect(state.objects.compartment).toEqual({
				flags: { open: false, discovered: false },
				contains: ["brass_key"],
			});
			expect(state.objects.journal).toEqual({
				flags: { read: false },
				contains: ["study_key"],
			});
			expect(state.objects.oak_desk).toEqual({
				flags: { examined: false },
			});
		});

		it("study_key is in journal contains", () => {
			const state = buildInitialState(theForgottenManor);

			expect(state.objects.journal.contains).toEqual(["study_key"]);
		});
	});
});
