import { describe, expect, it } from "vitest";
import type { World } from "../../world/types";
import { makeTestWorld } from "../__fixtures__/test-world";
import { buildInitialState } from "../initial-state";
import { setObjectState } from "../mutators";
import { executeAction } from "./executor";
import { createRules } from "./index";

function setup(overrides?: Partial<World>) {
	const world = makeTestWorld(overrides);
	const { bus } = createRules(world);
	const state = buildInitialState(world);
	return { world, bus, state };
}

describe("executeAction", () => {
	// ── take ──────────────────────────────────────────────────────────────

	it("take moves object from room to inventory", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "take", {
			target: "lamp",
		});

		expect(result.cancelled).toBe(false);
		expect(result.state.player.inventory).toContain("lamp");
		expect(result.state.rooms.room_a.contains).not.toContain("lamp");
	});

	it("take blocked for non-carriable objects", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "take", {
			target: "table",
		});

		expect(result.cancelled).toBe(true);
		expect(result.feedback).toContain("You can't take that.");
	});

	it("take blocked for already-carried objects", () => {
		const { world, bus, state } = setup();
		// sword is already in inventory
		const result = executeAction(bus, world, state, "take", {
			target: "sword",
		});

		expect(result.cancelled).toBe(true);
		expect(result.feedback).toContain("You're already carrying that.");
	});

	// ── drop ──────────────────────────────────────────────────────────────

	it("drop moves object from inventory to room", () => {
		const { world, bus, state } = setup();
		// sword is in inventory
		const result = executeAction(bus, world, state, "drop", {
			target: "sword",
		});

		expect(result.cancelled).toBe(false);
		expect(result.state.player.inventory).not.toContain("sword");
		expect(result.state.rooms.room_a.contains).toContain("sword");
	});

	// ── open ──────────────────────────────────────────────────────────────

	it("open sets open=true", () => {
		const { world, bus, state } = setup();
		// chest starts closed and not locked
		const result = executeAction(bus, world, state, "open", {
			target: "chest",
		});

		expect(result.cancelled).toBe(false);
		expect(result.state.objects.chest.flags.open).toBe(true);
	});

	it("open blocked when locked", () => {
		const { world, bus, state } = setup();
		// door starts locked
		const result = executeAction(bus, world, state, "open", {
			target: "door",
		});

		expect(result.cancelled).toBe(true);
		expect(result.feedback).toContain("It's locked.");
	});

	it("open blocked when already open", () => {
		const { world, bus } = setup();
		let { state } = setup();
		// Manually open the chest
		state = setObjectState(state, "chest", "open", true);

		const result = executeAction(bus, world, state, "open", {
			target: "chest",
		});

		expect(result.cancelled).toBe(true);
		expect(result.feedback).toContain("It's already open.");
	});

	// ── close ─────────────────────────────────────────────────────────────

	it("close sets open=false", () => {
		const { world, bus } = setup();
		let { state } = setup();
		// First open the chest
		state = setObjectState(state, "chest", "open", true);

		const result = executeAction(bus, world, state, "close", {
			target: "chest",
		});

		expect(result.cancelled).toBe(false);
		expect(result.state.objects.chest.flags.open).toBe(false);
	});

	it("close blocked when already closed", () => {
		const { world, bus, state } = setup();
		// chest starts closed (open: false)
		const result = executeAction(bus, world, state, "close", {
			target: "chest",
		});

		expect(result.cancelled).toBe(true);
		expect(result.feedback).toContain("It's already closed.");
	});

	// ── unlock ────────────────────────────────────────────────────────────

	it("unlock with correct instrument sets locked=false", () => {
		const { world, bus, state } = setup({
			objects: {
				...makeTestWorld().objects,
				door: {
					...makeTestWorld().objects.door,
					requires_instrument: { unlock: "sword" },
				},
			},
		});

		const result = executeAction(bus, world, state, "unlock", {
			target: "door",
			instrument: "sword",
		});

		expect(result.cancelled).toBe(false);
		expect(result.state.objects.door.flags.locked).toBe(false);
	});

	it("unlock blocked with wrong instrument", () => {
		const { world, bus, state } = setup({
			objects: {
				...makeTestWorld().objects,
				door: {
					...makeTestWorld().objects.door,
					requires_instrument: { unlock: "brass_key" },
				},
			},
		});

		const result = executeAction(bus, world, state, "unlock", {
			target: "door",
			instrument: "sword",
		});

		expect(result.cancelled).toBe(true);
		expect(result.feedback).toContain("That doesn't fit the lock.");
	});

	it("unlock blocked without instrument", () => {
		const { world, bus, state } = setup();

		const result = executeAction(bus, world, state, "unlock", {
			target: "door",
		});

		expect(result.cancelled).toBe(true);
		expect(result.feedback).toContain(
			"You don't have anything to unlock it with.",
		);
	});

	// ── go ────────────────────────────────────────────────────────────────

	it("go moves player and marks room visited", () => {
		const { world, bus, state } = setup();
		// Use the unconditional south exit from room_a to room_b
		const result = executeAction(bus, world, state, "go", {
			direction: "south",
		});

		expect(result.cancelled).toBe(false);
		expect(result.state.player.current_room).toBe("room_b");
		expect(result.state.rooms.room_b.flags.visited).toBe(true);
	});

	it("go blocked when exit condition fails", () => {
		const { world, bus, state } = setup();
		// north exit requires door.open == true, but door starts locked/closed
		const result = executeAction(bus, world, state, "go", {
			direction: "north",
		});

		expect(result.cancelled).toBe(true);
		expect(result.feedback).toContain("The door is locked.");
	});

	// ── examine ───────────────────────────────────────────────────────────

	it("examine sets examined=true", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "examine", {
			target: "lamp",
		});

		expect(result.cancelled).toBe(false);
		expect(result.state.objects.lamp.flags.examined).toBe(true);
	});

	// ── tick ──────────────────────────────────────────────────────────────

	it("tick increments moves", () => {
		const { world, bus, state } = setup();
		const movesBefore = (state.player.state.moves as number) ?? 0;

		const result = executeAction(
			bus,
			world,
			state,
			"tick",
			{} as Record<string, never>,
		);

		expect(result.state.player.state.moves).toBe(movesBefore + 1);
	});

	// ── look ──────────────────────────────────────────────────────────────

	it("look returns room description with objects and exits", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "look", {});

		expect(result.cancelled).toBe(false);
		expect(result.feedback.length).toBeGreaterThan(0);
		const text = result.feedback.join(" ");
		expect(text).toContain("Room A");
		expect(text).toContain("You can see:");
		expect(text).toContain("Exits:");
	});

	// ── inventory ─────────────────────────────────────────────────────────

	it("inventory lists carried items", () => {
		const { world, bus, state } = setup();
		// sword is in inventory
		const result = executeAction(bus, world, state, "inventory", {});

		expect(result.cancelled).toBe(false);
		expect(result.feedback.join(" ")).toContain("iron sword");
	});

	it("inventory reports empty when nothing carried", () => {
		const { world, bus } = setup();
		let { state } = setup();
		// Remove sword from inventory
		state = {
			...state,
			player: { ...state.player, inventory: [] },
		};

		const result = executeAction(bus, world, state, "inventory", {});

		expect(result.feedback.join(" ")).toContain(
			"You aren't carrying anything.",
		);
	});

	// ── quit ──────────────────────────────────────────────────────────────

	it("quit sets player quit flag", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "quit", {});

		expect(result.cancelled).toBe(false);
		expect(result.state.player.state.quit).toBe(true);
		expect(result.feedback.join(" ")).toContain("Goodbye!");
	});
});
