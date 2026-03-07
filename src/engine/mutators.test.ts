import { describe, expect, it } from "vitest";
import { makeTestWorld } from "./__fixtures__/test-world";
import { buildInitialState } from "./initial-state";
import {
	ensureVisited,
	immutable,
	isInInventory,
	isInRoom,
	moveObjectFromContainerToInventory,
	moveObjectFromInventoryToContainer,
	moveObjectFromInventoryToRoom,
	moveObjectFromRoomToInventory,
	movePlayer,
	setObjectState,
	setPlayerState,
	setRoomState,
} from "./mutators";
import type { GameState } from "./types";

function freshState(): GameState {
	return buildInitialState(makeTestWorld());
}

/** Deep-freeze an object so any mutation throws */
function deepFreeze<T extends object>(obj: T): T {
	Object.freeze(obj);
	for (const value of Object.values(obj)) {
		if (value && typeof value === "object" && !Object.isFrozen(value)) {
			deepFreeze(value);
		}
	}
	return obj;
}

describe("mutators", () => {
	// ─── Query Helpers ───────────────────────────────────────────────────────

	describe("isInRoom", () => {
		it("returns true for object in current room", () => {
			const state = freshState();
			expect(isInRoom(state, "door")).toBe(true);
			expect(isInRoom(state, "lamp")).toBe(true);
		});

		it("returns false for object not in current room", () => {
			const state = freshState();
			expect(isInRoom(state, "table")).toBe(false); // in room_b
			expect(isInRoom(state, "sword")).toBe(false); // in inventory
		});
	});

	describe("isInInventory", () => {
		it("returns true for object in inventory", () => {
			const state = freshState();
			expect(isInInventory(state, "sword")).toBe(true);
		});

		it("returns false for object not in inventory", () => {
			const state = freshState();
			expect(isInInventory(state, "lamp")).toBe(false);
		});
	});

	// ─── Move Functions ──────────────────────────────────────────────────────

	describe("moveObjectFromRoomToInventory", () => {
		it("removes from room contains and adds to inventory", () => {
			const state = freshState();
			const next = immutable(state, (s) => moveObjectFromRoomToInventory(s, "lamp"));

			expect(next.rooms.room_a.contains).not.toContain("lamp");
			expect(next.player.inventory).toContain("lamp");
		});

		it("throws if object not in current room", () => {
			const state = freshState();
			expect(() => moveObjectFromRoomToInventory(state, "table")).toThrow('Object "table" is not in room "room_a"');
		});

		it("does not mutate original state", () => {
			const state = deepFreeze(freshState());
			const next = immutable(state, (s) => moveObjectFromRoomToInventory(s, "lamp"));

			expect(state.rooms.room_a.contains).toContain("lamp");
			expect(state.player.inventory).not.toContain("lamp");
			expect(next).not.toBe(state);
		});
	});

	describe("moveObjectFromInventoryToRoom", () => {
		it("removes from inventory and adds to room contains", () => {
			const state = freshState();
			const next = immutable(state, (s) => moveObjectFromInventoryToRoom(s, "sword", "room_b"));

			expect(next.player.inventory).not.toContain("sword");
			expect(next.rooms.room_b.contains).toContain("sword");
		});

		it("throws if object not in inventory", () => {
			const state = freshState();
			expect(() => moveObjectFromInventoryToRoom(state, "lamp", "room_a")).toThrow(
				'Object "lamp" is not in inventory',
			);
		});

		it("does not mutate original state", () => {
			const state = deepFreeze(freshState());
			const next = immutable(state, (s) => moveObjectFromInventoryToRoom(s, "sword", "room_a"));

			expect(state.player.inventory).toContain("sword");
			expect(state.rooms.room_a.contains).not.toContain("sword");
			expect(next).not.toBe(state);
		});
	});

	describe("moveObjectFromContainerToInventory", () => {
		it("removes from container contains and adds to inventory", () => {
			const state = freshState();
			const next = immutable(state, (s) => moveObjectFromContainerToInventory(s, "gem", "chest"));

			expect(next.objects.chest.contains).not.toContain("gem");
			expect(next.player.inventory).toContain("gem");
		});

		it("throws if object not in container", () => {
			const state = freshState();
			expect(() => moveObjectFromContainerToInventory(state, "lamp", "chest")).toThrow(
				'Object "lamp" is not in container "chest"',
			);
		});

		it("does not mutate original state", () => {
			const state = deepFreeze(freshState());
			const next = immutable(state, (s) => moveObjectFromContainerToInventory(s, "gem", "chest"));

			expect(state.objects.chest.contains).toContain("gem");
			expect(state.player.inventory).not.toContain("gem");
			expect(next).not.toBe(state);
		});
	});

	describe("moveObjectFromInventoryToContainer", () => {
		it("removes from inventory and adds to container contains", () => {
			const state = freshState();
			const next = immutable(state, (s) => moveObjectFromInventoryToContainer(s, "sword", "chest"));

			expect(next.player.inventory).not.toContain("sword");
			expect(next.objects.chest.contains).toContain("sword");
		});

		it("throws if object not in inventory", () => {
			const state = freshState();
			expect(() => moveObjectFromInventoryToContainer(state, "lamp", "chest")).toThrow(
				'Object "lamp" is not in inventory',
			);
		});

		it("does not mutate original state", () => {
			const state = deepFreeze(freshState());
			const next = immutable(state, (s) => moveObjectFromInventoryToContainer(s, "sword", "chest"));

			expect(state.player.inventory).toContain("sword");
			expect(state.objects.chest.contains).not.toContain("sword");
			expect(next).not.toBe(state);
		});
	});

	describe("no object appears in more than one location after move", () => {
		it("lamp exists in exactly one location after room-to-inventory", () => {
			const state = freshState();
			const next = immutable(state, (s) => moveObjectFromRoomToInventory(s, "lamp"));

			const inRooms = Object.values(next.rooms).filter((r: { contains: string[] }) => r.contains.includes("lamp"));
			const inContainers = Object.values(next.objects).filter((o: { contains?: string[] }) =>
				o.contains?.includes("lamp"),
			);
			const inInventory = next.player.inventory.includes("lamp") ? 1 : 0;

			expect(inRooms.length + inContainers.length + inInventory).toBe(1);
		});

		it("sword exists in exactly one location after inventory-to-room", () => {
			const state = freshState();
			const next = immutable(state, (s) => moveObjectFromInventoryToRoom(s, "sword", "room_a"));

			const inRooms = Object.values(next.rooms).filter((r: { contains: string[] }) => r.contains.includes("sword"));
			const inContainers = Object.values(next.objects).filter((o: { contains?: string[] }) =>
				o.contains?.includes("sword"),
			);
			const inInventory = next.player.inventory.includes("sword") ? 1 : 0;

			expect(inRooms.length + inContainers.length + inInventory).toBe(1);
		});

		it("gem exists in exactly one location after container-to-inventory", () => {
			const state = freshState();
			const next = immutable(state, (s) => moveObjectFromContainerToInventory(s, "gem", "chest"));

			const inRooms = Object.values(next.rooms).filter((r: { contains: string[] }) => r.contains.includes("gem"));
			const inContainers = Object.values(next.objects).filter((o: { contains?: string[] }) =>
				o.contains?.includes("gem"),
			);
			const inInventory = next.player.inventory.includes("gem") ? 1 : 0;

			expect(inRooms.length + inContainers.length + inInventory).toBe(1);
		});
	});

	// ─── State Setters ───────────────────────────────────────────────────────

	describe("setObjectState", () => {
		it("sets a flag on an object", () => {
			const state = freshState();
			const next = immutable(state, (s) => setObjectState(s, "door", "locked", false));

			expect(next.objects.door.state.locked).toBe(false);
		});

		it("throws if object does not exist", () => {
			const state = freshState();
			expect(() => setObjectState(state, "ghost", "visible", true)).toThrow('Object "ghost" does not exist');
		});

		it("does not mutate original state", () => {
			const state = deepFreeze(freshState());
			const next = immutable(state, (s) => setObjectState(s, "door", "locked", false));

			expect(state.objects.door.state.locked).toBe(true);
			expect(next.objects.door.state.locked).toBe(false);
		});
	});

	describe("setRoomState", () => {
		it("sets a flag on a room", () => {
			const state = freshState();
			const next = immutable(state, (s) => setRoomState(s, "room_a", "dark", true));

			expect(next.rooms.room_a.state.dark).toBe(true);
		});

		it("throws if room does not exist", () => {
			const state = freshState();
			expect(() => setRoomState(state, "void", "dark", true)).toThrow('Room "void" does not exist');
		});

		it("does not mutate original state", () => {
			const state = deepFreeze(freshState());
			const next = immutable(state, (s) => setRoomState(s, "room_a", "dark", true));

			expect(state.rooms.room_a.state.dark).toBeUndefined();
			expect(next.rooms.room_a.state.dark).toBe(true);
		});
	});

	describe("setPlayerState", () => {
		it("sets a flag on player state", () => {
			const state = freshState();
			const next = immutable(state, (s) => setPlayerState(s, "moves", 5));

			expect(next.player.state.moves).toBe(5);
		});

		it("does not mutate original state", () => {
			const state = deepFreeze(freshState());
			const next = immutable(state, (s) => setPlayerState(s, "moves", 5));

			expect(state.player.state.moves).toBe(0);
			expect(next.player.state.moves).toBe(5);
		});
	});

	// ─── Player Movement ─────────────────────────────────────────────────────

	describe("movePlayer", () => {
		it("updates current_room", () => {
			const state = freshState();
			const next = immutable(state, (s) => movePlayer(s, "room_b"));

			expect(next.player.current_room).toBe("room_b");
		});

		it("does not mutate original state", () => {
			const state = deepFreeze(freshState());
			const next = immutable(state, (s) => movePlayer(s, "room_b"));

			expect(state.player.current_room).toBe("room_a");
			expect(next.player.current_room).toBe("room_b");
		});
	});

	describe("ensureVisited", () => {
		it("marks room visited", () => {
			const state = freshState();
			const next = immutable(state, (s) => ensureVisited(s, "room_a"));

			expect(next.rooms.room_a.state.visited).toBe(true);
		});

		it("is idempotent", () => {
			const state = freshState();
			const once = immutable(state, (s) => ensureVisited(s, "room_a"));
			const twice = immutable(once, (s) => ensureVisited(s, "room_a"));

			expect(twice.rooms.room_a.state.visited).toBe(true);
			expect(twice).toBe(once);
		});

		it("does not mutate original state", () => {
			const state = deepFreeze(freshState());
			const next = immutable(state, (s) => ensureVisited(s, "room_a"));

			expect(state.rooms.room_a.state.visited).toBe(false);
			expect(next.rooms.room_a.state.visited).toBe(true);
		});
	});
});
