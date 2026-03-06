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
			objects: ["lamp"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.player.inventory).toContain("lamp");
		expect(result.state.rooms.room_a.contains).not.toContain("lamp");
	});

	it("take with objects array takes multiple (TAKE X and Y)", () => {
		const base = makeTestWorld();
		const { world, bus, state } = setup({
			rooms: {
				...base.rooms,
				room_a: {
					...base.rooms.room_a,
					contains: ["door", "lamp", "chest", "gem"],
				},
			},
			objects: {
				...base.objects,
				chest: { ...base.objects.chest, contains: [] },
			},
		});
		const result = executeAction(bus, world, state, "take", {
			objects: ["lamp", "gem"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.player.inventory).toContain("lamp");
		expect(result.state.player.inventory).toContain("gem");
		expect(result.state.rooms.room_a.contains).not.toContain("lamp");
		expect(result.state.rooms.room_a.contains).not.toContain("gem");
	});

	it("take blocked for non-carriable objects", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "take", {
			objects: ["table"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("You can't take that.");
	});

	it("take blocked for already-carried objects", () => {
		const { world, bus, state } = setup();
		// sword is already in inventory
		const result = executeAction(bus, world, state, "take", {
			objects: ["sword"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("You're already carrying that.");
	});

	// ── drop ──────────────────────────────────────────────────────────────

	it("drop moves object from inventory to room", () => {
		const { world, bus, state } = setup();
		// sword is in inventory
		const result = executeAction(bus, world, state, "drop", {
			objects: ["sword"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.player.inventory).not.toContain("sword");
		expect(result.state.rooms.room_a.contains).toContain("sword");
	});

	it("drop with objects array drops multiple (DROP X and Y)", () => {
		const { world, bus, state } = setup();
		// Put sword and lamp in inventory: take lamp first
		let s = state;
		s = executeAction(bus, world, s, "take", { objects: ["lamp"] }).state;
		expect(s.player.inventory).toContain("sword");
		expect(s.player.inventory).toContain("lamp");

		const result = executeAction(bus, world, s, "drop", {
			objects: ["sword", "lamp"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.player.inventory).not.toContain("sword");
		expect(result.state.player.inventory).not.toContain("lamp");
		expect(result.state.rooms.room_a.contains).toContain("sword");
		expect(result.state.rooms.room_a.contains).toContain("lamp");
	});

	it("drop all (objects = full inventory)", () => {
		const { world, bus, state } = setup();
		// Take lamp so we have two items
		let s = state;
		s = executeAction(bus, world, s, "take", { objects: ["lamp"] }).state;

		const result = executeAction(bus, world, s, "drop", {
			objects: ["sword", "lamp"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.player.inventory).toHaveLength(0);
		expect(result.state.rooms.room_a.contains).toContain("sword");
		expect(result.state.rooms.room_a.contains).toContain("lamp");
	});

	it("drop with no target cancels", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "drop", { objects: [] });

		expect(result.stopped).toBe(true);
		expect(result.feedback.some((m) => m.includes("Drop what"))).toBe(true);
	});

	it("drop with objects not in inventory cancels", () => {
		const { world, bus, state } = setup();
		// Only sword in inventory; ask to drop lamp and gem
		const result = executeAction(bus, world, state, "drop", {
			objects: ["lamp", "gem"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback.some((m) => m.includes("not carrying"))).toBe(true);
	});

	// ── open ──────────────────────────────────────────────────────────────

	it("open sets open=true", () => {
		const { world, bus, state } = setup();
		// chest starts closed and not locked
		const result = executeAction(bus, world, state, "open", {
			objects: ["chest"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.objects.chest.state.open).toBe(true);
	});

	it("open blocked when locked", () => {
		const { world, bus, state } = setup();
		// door starts locked
		const result = executeAction(bus, world, state, "open", {
			objects: ["door"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("It's locked.");
	});

	it("open blocked when already open", () => {
		const { world, bus } = setup();
		let { state } = setup();
		// Manually open the chest
		state = setObjectState(state, "chest", "open", true);

		const result = executeAction(bus, world, state, "open", {
			objects: ["chest"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("It's already open.");
	});

	// ── close ─────────────────────────────────────────────────────────────

	it("close sets open=false", () => {
		const { world, bus } = setup();
		let { state } = setup();
		// First open the chest
		state = setObjectState(state, "chest", "open", true);

		const result = executeAction(bus, world, state, "close", {
			objects: ["chest"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.objects.chest.state.open).toBe(false);
	});

	it("close blocked when already closed", () => {
		const { world, bus, state } = setup();
		// chest starts closed (open: false)
		const result = executeAction(bus, world, state, "close", {
			objects: ["chest"],
		});

		expect(result.stopped).toBe(true);
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
			objects: ["door", "sword"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.objects.door.state.locked).toBe(false);
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
			objects: ["door", "sword"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("That doesn't fit the lock.");
	});

	it("unlock blocked without instrument", () => {
		const { world, bus, state } = setup();

		const result = executeAction(bus, world, state, "unlock", {
			objects: ["door"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("You don't have anything to unlock it with.");
	});

	// ── go ────────────────────────────────────────────────────────────────

	it("go moves player and marks room visited", () => {
		const { world, bus, state } = setup();
		// Use the unconditional south exit from room_a to room_b
		const result = executeAction(bus, world, state, "go", {
			direction: "south",
		});

		expect(result.stopped).toBe(false);
		expect(result.state.player.current_room).toBe("room_b");
		expect(result.state.rooms.room_b.state.visited).toBe(true);
	});

	it("go blocked when exit condition fails", () => {
		const { world, bus, state } = setup();
		// north exit requires door.open == true, but door starts locked/closed
		const result = executeAction(bus, world, state, "go", {
			direction: "north",
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("The door is locked.");
	});

	// ── examine ───────────────────────────────────────────────────────────

	it("examine sets examined=true", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "examine", {
			objects: ["lamp"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.objects.lamp.state.examined).toBe(true);
	});

	it("examine with preposition returns preposition description as feedback", () => {
		const base = makeTestWorld();
		const { world, bus, state } = setup({
			objects: {
				...base.objects,
				chest: {
					...base.objects.chest,
					descriptions: {
						default: "A wooden chest.",
						behind: "A small key is hidden behind the chest.",
					},
				},
			},
		});
		const result = executeAction(bus, world, state, "examine", {
			objects: ["chest"],
			preposition: "behind",
		});

		expect(result.stopped).toBe(false);
		expect(result.feedback).toContain("A small key is hidden behind the chest.");
		expect(result.state.objects.chest?.state.examined).toBe(true);
	});

	it("examine with target only returns default object description as feedback", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "examine", {
			objects: ["lamp"],
		});

		expect(result.stopped).toBe(false);
		expect(result.feedback).toContain("A brass lamp.");
	});

	// ── tick ──────────────────────────────────────────────────────────────

	it("tick increments moves", () => {
		const { world, bus, state } = setup();
		const movesBefore = (state.player.state.moves as number) ?? 0;

		const result = executeAction(bus, world, state, "tick", {} as Record<string, never>);

		expect(result.state.player.state.moves).toBe(movesBefore + 1);
	});

	// ── look ──────────────────────────────────────────────────────────────

	it("look returns room description with objects and exits", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "look", {});

		expect(result.stopped).toBe(false);
		expect(result.feedback.length).toBeGreaterThan(0);
		const text = result.feedback.join(" ");
		expect(text).toContain("Room A");
		expect(text).toContain("There is a");
		expect(text).toContain("Exits:");
	});

	// ── inventory ─────────────────────────────────────────────────────────

	it("inventory lists carried items", () => {
		const { world, bus, state } = setup();
		// sword is in inventory
		const result = executeAction(bus, world, state, "inventory", {});

		expect(result.stopped).toBe(false);
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

		expect(result.feedback.join(" ")).toContain("You aren't carrying anything.");
	});

	// ── quit ──────────────────────────────────────────────────────────────

	it("quit sets player quit flag", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "quit", {});

		expect(result.stopped).toBe(false);
		expect(result.state.player.state.quit).toBe(true);
		expect(result.feedback.join(" ")).toContain("Goodbye!");
	});
});
