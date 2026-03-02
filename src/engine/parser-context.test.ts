import { describe, expect, it } from "vitest";
import theForgottenManor from "../../games/the-forgotten-manor";
import theGreatHall from "../../games/the-great-hall";
import type { GameObject, Room } from "../world/types";
import { makeTestWorld } from "./__fixtures__/test-world";
import { buildInitialState } from "./initial-state";
import {
	buildParserContext,
	evaluateCondition,
	resolveObjectDescription,
	resolveRoomDescription,
} from "./parser-context";
import type { GameState, ObjectState, RoomState } from "./types";

// ─── evaluateCondition ───────────────────────────────────────────────────────

describe("evaluateCondition", () => {
	function stateWith(
		objectId: string,
		flags: Record<string, boolean | string | number>,
	): GameState {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		const current = state.objects[objectId];
		state.objects[objectId] = {
			...(current && "contains" in current && current.contains
				? { contains: current.contains }
				: {}),
			flags: { ...(current?.flags ?? {}), ...flags },
		};
		return state;
	}

	it("evaluates == true for booleans", () => {
		const state = stateWith("door", { open: true });
		expect(evaluateCondition("door.open == true", state)).toBe(true);
	});

	it("evaluates == false for booleans", () => {
		const state = stateWith("door", { open: false });
		expect(evaluateCondition("door.open == true", state)).toBe(false);
	});

	it("evaluates != operator", () => {
		const state = stateWith("door", { open: false });
		expect(evaluateCondition("door.open != true", state)).toBe(true);
	});

	it("evaluates numeric comparisons", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		// counter may not exist in world; add minimal object state
		state.objects.counter = { flags: { value: 5 } };

		expect(evaluateCondition("counter.value > 3", state)).toBe(true);
		expect(evaluateCondition("counter.value < 3", state)).toBe(false);
		expect(evaluateCondition("counter.value >= 5", state)).toBe(true);
		expect(evaluateCondition("counter.value <= 5", state)).toBe(true);
		expect(evaluateCondition("counter.value == 5", state)).toBe(true);
	});

	it("evaluates string comparisons", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		state.objects.actor = { flags: { mood: "angry" } };

		expect(evaluateCondition("actor.mood == angry", state)).toBe(true);
		expect(evaluateCondition("actor.mood != happy", state)).toBe(true);
	});

	it("returns false for unknown objects", () => {
		const state = stateWith("door", { open: true });
		expect(evaluateCondition("phantom.open == true", state)).toBe(false);
	});

	it("returns false for missing state keys", () => {
		const state = stateWith("door", { open: true });
		expect(evaluateCondition("door.missing == true", state)).toBe(false);
	});

	it("returns false for unparseable conditions", () => {
		const state = stateWith("door", { open: true });
		expect(evaluateCondition("not a valid condition", state)).toBe(false);
	});
});

// ─── resolveRoomDescription ──────────────────────────────────────────────────

describe("resolveRoomDescription", () => {
	const room: Room = {
		id: "room_a",
		name: "Room A",
		descriptions: {
			default: "Default description.",
			visited: "Visited description.",
			dark: "Dark description.",
		},
		state: {},
		exits: {},
		contains: [],
	};

	it("returns default description for unvisited room with no state flags", () => {
		const roomState: RoomState = { contains: [], flags: { visited: false } };
		expect(resolveRoomDescription(room, roomState)).toBe(
			"Default description.",
		);
	});

	it("returns visited description for visited room", () => {
		const roomState: RoomState = { contains: [], flags: { visited: true } };
		expect(resolveRoomDescription(room, roomState)).toBe(
			"Visited description.",
		);
	});

	it("returns state-driven description when a matching state flag is true", () => {
		const roomState: RoomState = {
			contains: [],
			flags: { visited: false, dark: true },
		};
		expect(resolveRoomDescription(room, roomState)).toBe("Dark description.");
	});

	it("prioritises state-driven descriptions over visited", () => {
		const roomState: RoomState = {
			contains: [],
			flags: { visited: true, dark: true },
		};
		expect(resolveRoomDescription(room, roomState)).toBe("Dark description.");
	});

	it("falls back to default when state flag is false", () => {
		const roomState: RoomState = {
			contains: [],
			flags: { visited: false, dark: false },
		};
		expect(resolveRoomDescription(room, roomState)).toBe(
			"Default description.",
		);
	});
});

// ─── resolveObjectDescription ────────────────────────────────────────────────

describe("resolveObjectDescription", () => {
	const obj: GameObject = {
		id: "lamp",
		name: "brass lamp",
		synonyms: ["lamp"],
		type: "item",
		state: { carriable: true },
		descriptions: {
			default: "A brass lamp.",
			lit: "The lamp glows brightly.",
		},
	};

	it("returns default description when no flags are true", () => {
		const objState: ObjectState = { flags: { lit: false } };
		expect(resolveObjectDescription(obj, objState)).toBe("A brass lamp.");
	});

	it("returns state-driven description when matching flag is true", () => {
		const objState: ObjectState = { flags: { lit: true } };
		expect(resolveObjectDescription(obj, objState)).toBe(
			"The lamp glows brightly.",
		);
	});

	it("returns default when flag is true but no matching description", () => {
		const objState: ObjectState = { flags: { broken: true } };
		expect(resolveObjectDescription(obj, objState)).toBe("A brass lamp.");
	});

	it("returns default for empty flags", () => {
		const objState: ObjectState = { flags: {} };
		expect(resolveObjectDescription(obj, objState)).toBe("A brass lamp.");
	});
});

// ─── buildParserContext ──────────────────────────────────────────────────────

describe("buildParserContext", () => {
	it("builds a valid context for the starting room", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		const ctx = buildParserContext(world, state);

		expect(ctx.room).toBe("Room A");
		expect(ctx.description).toBe("You are in room A.");
	});

	it("includes unconditional exits as available", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		const ctx = buildParserContext(world, state);

		expect(ctx.available_exits).toContain("south");
	});

	it("blocks conditional exits when condition is false", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		// door.open is false by default
		const ctx = buildParserContext(world, state);

		expect(ctx.available_exits).not.toContain("north");
		expect(ctx.blocked_exits).toContainEqual({
			direction: "north",
			message: "The door is locked.",
		});
	});

	it("opens conditional exits when condition is true", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		state.objects.door.flags.open = true;

		const ctx = buildParserContext(world, state);

		expect(ctx.available_exits).toContain("north");
		expect(ctx.blocked_exits.map((e) => e.direction)).not.toContain("north");
	});

	it("includes room objects and inventory in scope", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		const ctx = buildParserContext(world, state);

		const ids = ctx.in_scope_objects.map((o) => o.id);
		// Room contents
		expect(ids).toContain("door");
		expect(ids).toContain("lamp");
		expect(ids).toContain("chest");
		// Inventory
		expect(ids).toContain("sword");
	});

	it("excludes objects in other rooms", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		const ctx = buildParserContext(world, state);

		const ids = ctx.in_scope_objects.map((o) => o.id);
		expect(ids).not.toContain("table");
	});

	it("excludes items inside containers from scope", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		const ctx = buildParserContext(world, state);

		const ids = ctx.in_scope_objects.map((o) => o.id);
		// gem is inside chest, not directly in room
		expect(ids).not.toContain("gem");
	});

	it("strips contains from scoped object state", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		const ctx = buildParserContext(world, state);

		const doorObj = ctx.in_scope_objects.find((o) => o.id === "door");
		expect(doorObj).toBeDefined();
		expect(doorObj?.state).toEqual({
			locked: true,
			open: false,
			carriable: false,
		});
	});

	it("throws for unknown current room", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		state.player.current_room = "void";

		expect(() => buildParserContext(world, state)).toThrow(
			'Unknown room "void"',
		);
	});

	it("uses visited description for visited rooms", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		state.rooms.room_a.flags.visited = true;

		const ctx = buildParserContext(world, state);
		expect(ctx.description).toBe("Room A again.");
	});
});

// ─── buildParserContext: The Great Hall ───────────────────────────────────────

describe("buildParserContext (The Great Hall)", () => {
	it("builds context for starting room (great_hall)", () => {
		const state = buildInitialState(theGreatHall);
		const ctx = buildParserContext(theGreatHall, state);

		console.log("--------------------------------");
		console.log(JSON.stringify(state, null, 2));
		console.log("--------------------------------");

		console.log("--------------------------------");
		console.log(JSON.stringify(ctx, null, 2));
		console.log("--------------------------------");

		expect(ctx.room).toBe("The Great Hall");
		expect(ctx.description).toContain("vast stone hall");
	});

	it("includes unconditional exits from great_hall", () => {
		const state = buildInitialState(theGreatHall);
		const ctx = buildParserContext(theGreatHall, state);

		expect(ctx.available_exits).toContain("north");
		expect(ctx.available_exits).toContain("west");
		expect(ctx.available_exits).toContain("up");
	});

	it("blocks cellar exit when cellar_door is closed", () => {
		const state = buildInitialState(theGreatHall);
		const ctx = buildParserContext(theGreatHall, state);

		expect(ctx.available_exits).not.toContain("down");
		expect(ctx.blocked_exits).toContainEqual({
			direction: "down",
			message: "The heavy iron door in the floor is locked.",
		});
	});

	it("opens cellar exit when cellar_door is open", () => {
		const state = buildInitialState(theGreatHall);
		state.objects.cellar_door.flags.open = true;
		const ctx = buildParserContext(theGreatHall, state);

		expect(ctx.available_exits).toContain("down");
		expect(ctx.blocked_exits.map((e) => e.direction)).not.toContain("down");
	});

	it("includes great_hall objects and excludes contained items", () => {
		const state = buildInitialState(theGreatHall);
		const ctx = buildParserContext(theGreatHall, state);

		const ids = ctx.in_scope_objects.map((o) => o.id);
		expect(ids).toContain("brass_lantern");
		expect(ids).toContain("cellar_door");
		expect(ids).not.toContain("gold_amulet");
		expect(ids).not.toContain("rusty_key");
	});

	it("builds context in library with alcove and old_book in scope", () => {
		const state = buildInitialState(theGreatHall);
		state.player.current_room = "library";
		const ctx = buildParserContext(theGreatHall, state);

		expect(ctx.room).toBe("The Library");
		const ids = ctx.in_scope_objects.map((o) => o.id);
		expect(ids).toContain("old_book");
		expect(ids).toContain("alcove");
		expect(ids).not.toContain("rusty_key");
	});

	it("builds context in tower_room with wooden_chest in scope", () => {
		const state = buildInitialState(theGreatHall);
		state.player.current_room = "tower_room";
		const ctx = buildParserContext(theGreatHall, state);

		expect(ctx.room).toBe("The Tower Room");
		const ids = ctx.in_scope_objects.map((o) => o.id);
		expect(ids).toContain("wooden_chest");
		expect(ids).not.toContain("gold_amulet");
	});
});

// ─── buildParserContext: The Forgotten Manor ─────────────────────────────────

describe("buildParserContext (The Forgotten Manor)", () => {
	it("builds context for starting room (entrance_hall)", () => {
		const state = buildInitialState(theForgottenManor);
		const ctx = buildParserContext(theForgottenManor, state);

		expect(ctx.room).toBe("Entrance Hall");
		expect(ctx.description).toContain("grand but dusty");
	});

	it("blocks north exit when library_door is closed", () => {
		const state = buildInitialState(theForgottenManor);
		const ctx = buildParserContext(theForgottenManor, state);

		expect(ctx.available_exits).not.toContain("north");
		expect(ctx.blocked_exits).toContainEqual({
			direction: "north",
			message: "The heavy oak door to the north is firmly locked.",
		});
	});

	it("opens north exit when library_door is open", () => {
		const state = buildInitialState(theForgottenManor);
		state.objects.library_door.flags.open = true;
		const ctx = buildParserContext(theForgottenManor, state);

		expect(ctx.available_exits).toContain("north");
	});

	it("includes entrance_hall objects in scope", () => {
		const state = buildInitialState(theForgottenManor);
		const ctx = buildParserContext(theForgottenManor, state);

		const ids = ctx.in_scope_objects.map((o) => o.id);
		expect(ids).toContain("painting");
		expect(ids).toContain("library_door");
		expect(ids).toContain("compartment");
		expect(ids).not.toContain("brass_key");
	});

	it("builds context in library and blocks east when study_door closed", () => {
		const state = buildInitialState(theForgottenManor);
		state.player.current_room = "library";
		const ctx = buildParserContext(theForgottenManor, state);

		expect(ctx.room).toBe("The Library");
		expect(ctx.available_exits).toContain("south");
		expect(ctx.available_exits).not.toContain("east");
		expect(ctx.blocked_exits).toContainEqual({
			direction: "east",
			message: "A narrow door to the east is locked tight.",
		});
	});

	it("opens east exit when study_door is open", () => {
		const state = buildInitialState(theForgottenManor);
		state.player.current_room = "library";
		state.objects.study_door.flags.open = true;
		const ctx = buildParserContext(theForgottenManor, state);

		expect(ctx.available_exits).toContain("east");
	});

	it("uses visited description for entrance_hall when visited", () => {
		const state = buildInitialState(theForgottenManor);
		state.rooms.entrance_hall.flags.visited = true;
		const ctx = buildParserContext(theForgottenManor, state);

		expect(ctx.description).toContain("painting watches you silently");
	});

	it("evaluateCondition: library_door.open for Forgotten Manor", () => {
		const state = buildInitialState(theForgottenManor);
		expect(evaluateCondition("library_door.open == true", state)).toBe(false);
		state.objects.library_door.flags.open = true;
		expect(evaluateCondition("library_door.open == true", state)).toBe(true);
	});
});
