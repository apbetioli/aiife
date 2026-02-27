import { describe, expect, it } from "vitest";
import type { Room } from "../world/types";
import { makeTestWorld } from "./__fixtures__/test-world";
import { buildInitialState } from "./initial-state";
import {
	buildParserContext,
	evaluateCondition,
	resolveRoomDescription,
} from "./parser-context";
import type { GameState, RoomState } from "./types";

// ─── evaluateCondition ───────────────────────────────────────────────────────

describe("evaluateCondition", () => {
	function stateWith(
		objectId: string,
		flags: Record<string, boolean | string | number>,
	): GameState {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		state.objects[objectId] = { location: "room_a", ...flags };
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
		const state = stateWith("counter", { value: 5 });

		expect(evaluateCondition("counter.value > 3", state)).toBe(true);
		expect(evaluateCondition("counter.value < 3", state)).toBe(false);
		expect(evaluateCondition("counter.value >= 5", state)).toBe(true);
		expect(evaluateCondition("counter.value <= 5", state)).toBe(true);
		expect(evaluateCondition("counter.value == 5", state)).toBe(true);
	});

	it("evaluates string comparisons", () => {
		const state = stateWith("npc", { mood: "angry" });
		expect(evaluateCondition("npc.mood == angry", state)).toBe(true);
		expect(evaluateCondition("npc.mood != happy", state)).toBe(true);
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
		const roomState: RoomState = { visited: false, contains: [] };
		expect(resolveRoomDescription(room, roomState)).toBe(
			"Default description.",
		);
	});

	it("returns visited description for visited room", () => {
		const roomState: RoomState = { visited: true, contains: [] };
		expect(resolveRoomDescription(room, roomState)).toBe(
			"Visited description.",
		);
	});

	it("returns state-driven description when a matching state flag is true", () => {
		const roomState: RoomState & Record<string, unknown> = {
			visited: false,
			contains: [],
			dark: true,
		};
		expect(resolveRoomDescription(room, roomState)).toBe("Dark description.");
	});

	it("prioritises state-driven descriptions over visited", () => {
		const roomState: RoomState & Record<string, unknown> = {
			visited: true,
			contains: [],
			dark: true,
		};
		expect(resolveRoomDescription(room, roomState)).toBe("Dark description.");
	});

	it("falls back to default when state flag is false", () => {
		const roomState: RoomState & Record<string, unknown> = {
			visited: false,
			contains: [],
			dark: false,
		};
		expect(resolveRoomDescription(room, roomState)).toBe(
			"Default description.",
		);
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
		state.objects.door.open = true;

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

	it("strips location and contains from scoped object state", () => {
		const world = makeTestWorld();
		const state = buildInitialState(world);
		const ctx = buildParserContext(world, state);

		const doorObj = ctx.in_scope_objects.find((o) => o.id === "door");
		expect(doorObj).toBeDefined();
		expect(doorObj?.state).toEqual({ locked: true, open: false });
		expect(
			(doorObj?.state as Record<string, unknown>).location,
		).toBeUndefined();
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
		state.rooms.room_a.visited = true;

		const ctx = buildParserContext(world, state);
		expect(ctx.description).toBe("Room A again.");
	});
});
