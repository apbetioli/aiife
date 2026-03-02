import { describe, expect, it } from "vitest";
import { makeTestWorld } from "../__fixtures__/test-world";
import { buildInitialState } from "../initial-state";
import { executeAction } from "./executor";
import { createRules } from "./index";

describe("registerContainer", () => {
	it("opening container moves contents to room", () => {
		const world = makeTestWorld();
		const bus = createRules(world);
		const state = buildInitialState(world);

		// chest contains gem, chest is in room_a
		expect(state.objects.chest.contains).toContain("gem");
		expect(state.rooms.room_a.contains).not.toContain("gem");

		const result = executeAction(bus, world, state, "open", {
			target: "chest",
		});

		expect(result.cancelled).toBe(false);
		expect(result.state.objects.chest.flags.open).toBe(true);
		// gem should now be in the room
		expect(result.state.rooms.room_a.contains).toContain("gem");
		// gem should no longer be in the container
		expect(result.state.objects.chest.contains).toEqual([]);
	});

	it("closing container moves contents back", () => {
		const world = makeTestWorld();
		const bus = createRules(world);
		let state = buildInitialState(world);

		// First open the chest to move gem to room
		const openResult = executeAction(bus, world, state, "open", {
			target: "chest",
		});
		state = openResult.state;

		expect(state.rooms.room_a.contains).toContain("gem");
		expect(state.objects.chest.contains).toEqual([]);

		// Now close it
		const closeResult = executeAction(bus, world, state, "close", {
			target: "chest",
		});

		expect(closeResult.state.rooms.room_a.contains).not.toContain("gem");
		expect(closeResult.state.objects.chest.contains).toContain("gem");
	});
});

describe("registerLockable", () => {
	function setupLockable() {
		const world = makeTestWorld({
			objects: {
				...makeTestWorld().objects,
				door: {
					...makeTestWorld().objects.door,
					requires_instrument: { unlock: "sword" },
				},
			},
		});
		const bus = createRules(world);
		const state = buildInitialState(world);
		return { world, bus, state };
	}

	it("correct key unlocks", () => {
		const { world, bus, state } = setupLockable();

		const result = executeAction(bus, world, state, "unlock", {
			target: "door",
			instrument: "sword",
		});

		expect(result.cancelled).toBe(false);
		expect(result.state.objects.door.flags.locked).toBe(false);
	});

	it("wrong key is blocked", () => {
		// door requires "sword" but we use a different key in inventory
		const world = makeTestWorld({
			objects: {
				...makeTestWorld().objects,
				door: {
					...makeTestWorld().objects.door,
					requires_instrument: { unlock: "brass_key" },
				},
			},
		});
		const bus = createRules(world);
		const state = buildInitialState(world);

		// sword is in inventory but isn't the right key
		const result = executeAction(bus, world, state, "unlock", {
			target: "door",
			instrument: "sword",
		});

		expect(result.cancelled).toBe(true);
		expect(result.feedback).toContain("That doesn't fit the lock.");
	});
});
