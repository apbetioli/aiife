import { describe, expect, it } from "vitest";
import theForgottenManorRaw from "../../games/the-forgotten-manor.json";
import theGreatHallGame from "../../games/the-great-hall";
import { WorldSchema } from "../world/types";
import { makeTestWorld } from "./__fixtures__/test-world";
import {
	buildInitialState,
	validateAllObjectsOwned,
	validateContainment,
	validateExitConditions,
} from "./initial-state";
import { getInventory } from "./mutators";

const theForgottenManor = WorldSchema.parse(theForgottenManorRaw);
const theGreatHall = theGreatHallGame.world;

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
						aliases: [],
						type: "actor",
						location: "nonexistent_room",
						state: { carriable: false },
						descriptions: { default: "A ghost." },
					},
				},
			});
			expect(validateAllObjectsOwned(world)).toContainEqual(expect.stringContaining('"ghost" is not in any room'));
		});
		it("returns error for double-owned object", () => {
			const world = makeTestWorld();
			world.player.inventory.push("table");
			expect(validateAllObjectsOwned(world)).toContainEqual(
				expect.stringMatching(/Object "table" is in player inventory.*but also in/),
			);
		});
	});

	describe("validateContainment", () => {
		it("returns empty for valid world", () => {
			expect(validateContainment(makeTestWorld())).toEqual([]);
		});
		it("returns error for player inventory referencing unknown object", () => {
			const world = makeTestWorld();
			world.player.inventory = ["nonexistent"];
			expect(validateContainment(world)).toContainEqual('Player inventory references unknown object "nonexistent"');
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
			expect(validateExitConditions(world)).toContainEqual(expect.stringContaining('unknown object "phantom"'));
		});
		it("returns error for leads_to unknown room", () => {
			const world = makeTestWorld();
			world.rooms.room_a.exits.north = {
				leads_to: "void",
				condition: "door.open == true",
				locked_message: "nope",
			};
			expect(validateExitConditions(world)).toContainEqual(expect.stringContaining('unknown room "void"'));
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

	it("initialises room states with visited state", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);

		expect(state.rooms.room_a).toEqual({
			state: { visited: false },
		});
		expect(state.rooms.room_b).toEqual({
			state: { visited: false },
		});
	});

	it("initialises object states with location and state", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);

		expect(state.objects.door).toEqual({
			location: "room_a",
			state: { locked: true, open: false, carriable: false },
		});
		expect(state.objects.lamp).toEqual({
			location: "room_a",
			state: { lit: false, carriable: true },
		});
		expect(state.objects.chest).toEqual({
			location: "room_a",
			state: { open: false, carriable: false },
		});
		expect(state.objects.gem).toEqual({
			location: "chest",
			state: { carriable: true },
		});
	});

	it("initialises player state from world definition", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);

		expect(state.player.current_room).toBe("room_a");
		expect(getInventory(state)).toEqual(["sword"]);
		expect(state.player.state).toEqual({ moves: 0 });
	});

	it("copies state by value, not by reference", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);

		state.player.state.moves = 99;
		expect(world.player.state.moves).toBe(0);
	});

	// ─── Validation: object placement ────────────────────────────────────────

	it("rejects object not in any room, container, or inventory", () => {
		const world = makeTestWorld({
			objects: {
				...makeTestWorld().objects,
				ghost: {
					id: "ghost",
					name: "ghost",
					aliases: [],
					type: "actor",
					location: "nowhere",
					state: { carriable: false },
					descriptions: { default: "A ghost." },
				},
			},
		});
		expect(() => buildInitialState(world)).toThrow('Object "ghost" is not in any room, container, or player inventory');
	});

	// ─── Validation: player inventory ────────────────────────────────────────

	it("rejects inventory referencing unknown objects", () => {
		const world = makeTestWorld();
		world.player.inventory = ["nonexistent"];

		expect(() => buildInitialState(world)).toThrow('Player inventory references unknown object "nonexistent"');
	});

	it("rejects inventory when object is also in a room", () => {
		const world = makeTestWorld();
		// lamp is in room_a; add to inventory too
		world.player.inventory = ["sword", "lamp"];

		expect(() => buildInitialState(world)).toThrow(/Object "lamp" is in player inventory but also in/);
	});

	// ─── Validation: exit conditions ─────────────────────────────────────────

	it("rejects exits with unparseable conditions", () => {
		const world = makeTestWorld();
		world.rooms.room_a.exits.north = {
			leads_to: "room_b",
			condition: "this is not valid",
			locked_message: "nope",
		};

		expect(() => buildInitialState(world)).toThrow('unparseable condition: "this is not valid"');
	});

	it("rejects exits referencing unknown objects in conditions", () => {
		const world = makeTestWorld();
		world.rooms.room_a.exits.north = {
			leads_to: "room_b",
			condition: "phantom.open == true",
			locked_message: "nope",
		};

		expect(() => buildInitialState(world)).toThrow('condition references unknown object "phantom"');
	});

	it("rejects exits leading to unknown rooms", () => {
		const world = makeTestWorld();
		world.rooms.room_a.exits.north = {
			leads_to: "void",
			condition: "door.open == true",
			locked_message: "nope",
		};

		expect(() => buildInitialState(world)).toThrow('leads_to unknown room "void"');
	});

	// ─── The Great Hall ───────────────────────────────────────────────────────

	describe("The Great Hall", () => {
		it("builds valid initial state from world", () => {
			const state = buildInitialState(theGreatHall);

			expect(state.world_id).toBe("the_great_hall");
			expect(state.version).toBe("1.0.0");
			expect(state.turn).toBe(0);
			expect(state.player.current_room).toBe("great_hall");
			expect(getInventory(state)).toEqual([]);
		});

		it("initialises all rooms with visited false", () => {
			const state = buildInitialState(theGreatHall);

			expect(state.rooms.great_hall).toEqual({
				state: { visited: false },
			});
			expect(state.rooms.garden).toEqual({ state: { visited: false } });
			expect(state.rooms.library).toEqual({ state: { visited: false } });
			expect(state.rooms.tower_room).toEqual({ state: { visited: false } });
			expect(state.rooms.cellar).toEqual({ state: { visited: false } });
		});

		it("initialises objects with location and state", () => {
			const state = buildInitialState(theGreatHall);

			expect(state.objects.cellar_door).toEqual({
				location: "great_hall",
				state: { locked: true, open: false, carriable: false },
			});
			expect(state.objects.wooden_chest).toEqual({
				location: "tower_room",
				state: { open: false, carriable: false },
			});
			expect(state.objects.alcove).toEqual({
				location: "library",
				state: { revealed: false, carriable: false },
			});
			expect(state.objects.gold_amulet.location).toBe("wooden_chest");
			expect(state.objects.rusty_key.location).toBe("alcove");
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
			expect(getInventory(state)).toEqual([]);
			expect(state.player.state).toEqual({ moves: 0, won: false });
		});

		it("initialises all rooms with visited false", () => {
			const state = buildInitialState(theForgottenManor);

			expect(state.rooms.entrance_hall).toEqual({
				state: { visited: false },
			});
			expect(state.rooms.library).toEqual({ state: { visited: false } });
			expect(state.rooms.garden).toEqual({ state: { visited: false } });
			expect(state.rooms.study).toEqual({ state: { visited: false } });
		});

		it("initialises objects with location and state", () => {
			const state = buildInitialState(theForgottenManor);

			expect(state.objects.library_door).toEqual({
				location: "entrance_hall",
				state: { locked: true, open: false, carriable: false },
			});
			expect(state.objects.compartment).toEqual({
				location: "entrance_hall",
				state: { open: false, discovered: false, carriable: false },
			});
			expect(state.objects.journal).toEqual({
				location: "library",
				state: { read: false, carriable: true },
			});
			expect(state.objects.oak_desk).toEqual({
				location: "study",
				state: { examined: false, carriable: false },
			});
		});

		it("study_key has location journal", () => {
			const state = buildInitialState(theForgottenManor);

			expect(state.objects.study_key.location).toBe("journal");
		});
	});
});
