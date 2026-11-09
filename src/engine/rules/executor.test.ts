import { describe, expect, it } from "vitest";
import type { World } from "../../world/types";
import { makeTestWorld } from "../__fixtures__/test-world";
import { GameEngine } from "../game-engine";
import { buildInitialState } from "../initial-state";
import { getInventory, immutable, isInInventory, setObjectState } from "../mutators";
import { registerCoreActions } from "./core-actions";
import { executeAction } from "./executor";
import { ActionRegistry, EventBus } from "./index";
import { PRIORITY } from "./priorities";

function setup(overrides?: Partial<World>) {
	const world = makeTestWorld(overrides);
	const bus = new EventBus();
	registerCoreActions(bus, new ActionRegistry());
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
		expect(isInInventory(result.state, "lamp")).toBe(true);
		expect(result.state.objects.lamp.location).toBe("inventory");
	});

	it("take with objects array takes multiple (TAKE X and Y)", () => {
		const base = makeTestWorld();
		const { world, bus, state } = setup({
			objects: {
				...base.objects,
				gem: { ...base.objects.gem, location: "room_a" },
			},
		});
		const result = executeAction(bus, world, state, "take", {
			objects: ["lamp", "gem"],
		});

		expect(result.stopped).toBe(false);
		expect(isInInventory(result.state, "lamp")).toBe(true);
		expect(isInInventory(result.state, "gem")).toBe(true);
		expect(result.state.objects.lamp.location).toBe("inventory");
		expect(result.state.objects.gem.location).toBe("inventory");
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
		expect(isInInventory(result.state, "sword")).toBe(false);
		expect(result.state.objects.sword.location).toBe("room_a");
	});

	it("drop with objects array drops multiple (DROP X and Y)", () => {
		const { world, bus, state } = setup();
		// Put sword and lamp in inventory: take lamp first
		let s = state;
		s = executeAction(bus, world, s, "take", { objects: ["lamp"] }).state;
		expect(isInInventory(s, "sword")).toBe(true);
		expect(isInInventory(s, "lamp")).toBe(true);

		const result = executeAction(bus, world, s, "drop", {
			objects: ["sword", "lamp"],
		});

		expect(result.stopped).toBe(false);
		expect(isInInventory(result.state, "sword")).toBe(false);
		expect(isInInventory(result.state, "lamp")).toBe(false);
		expect(result.state.objects.sword.location).toBe("room_a");
		expect(result.state.objects.lamp.location).toBe("room_a");
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
		expect(getInventory(result.state)).toHaveLength(0);
		expect(result.state.objects.sword.location).toBe("room_a");
		expect(result.state.objects.lamp.location).toBe("room_a");
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

	// ── put ───────────────────────────────────────────────────────────────

	it("put moves object from inventory into open container", () => {
		const { world, bus, state } = setup();
		const openResult = executeAction(bus, world, state, "open", { objects: ["chest"] });
		const result = executeAction(bus, world, openResult.state, "put", {
			objects: ["sword", "chest"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.objects.sword.location).toBe("chest");
		expect(isInInventory(result.state, "sword")).toBe(false);
		expect(result.feedback).toContain("You put the iron sword into the wooden chest.");
	});

	it("put moves object from room into open container", () => {
		const { world, bus, state } = setup();
		const openResult = executeAction(bus, world, state, "open", { objects: ["chest"] });
		const result = executeAction(bus, world, openResult.state, "put", {
			objects: ["lamp", "chest"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.objects.lamp.location).toBe("chest");
		expect(result.feedback).toContain("You put the brass lamp into the wooden chest.");
	});

	it("put blocked when container is closed", () => {
		const { world, bus, state } = setup();
		// chest starts closed
		const result = executeAction(bus, world, state, "put", {
			objects: ["sword", "chest"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("The wooden chest is closed.");
		expect(isInInventory(result.state, "sword")).toBe(true);
	});

	it("put blocked when target is not a container", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "put", {
			objects: ["sword", "door"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("The wooden door is not a container.");
	});

	it("put blocked when placing object into itself", () => {
		const { world, bus, state } = setup();
		const openResult = executeAction(bus, world, state, "open", { objects: ["chest"] });
		const result = executeAction(bus, world, openResult.state, "put", {
			objects: ["chest", "chest"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("You can't put something inside itself.");
	});

	it("put blocked when placing container into one of its child contents", () => {
		const base = makeTestWorld();
		const { world, bus, state } = setup({
			objects: {
				...base.objects,
				pouch: {
					id: "pouch",
					name: "leather pouch",
					aliases: [],
					type: "container",
					location: "chest",
					state: { open: true, carriable: true },
					descriptions: { default: "A leather pouch." },
				},
			},
		});

		const openResult = executeAction(bus, world, state, "open", { objects: ["chest"] });
		const result = executeAction(bus, world, openResult.state, "put", {
			objects: ["chest", "pouch"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("You can't put something inside one of its contents.");
	});

	it("put blocked when object is already in target container", () => {
		const { world, bus, state } = setup();
		const openResult = executeAction(bus, world, state, "open", { objects: ["chest"] });
		const result = executeAction(bus, world, openResult.state, "put", {
			objects: ["gem", "chest"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("The red gem is already in the wooden chest.");
	});

	it("put blocked with missing targets", () => {
		const { world, bus, state } = setup();
		const noTargets = executeAction(bus, world, state, "put", { objects: [] });
		expect(noTargets.stopped).toBe(true);
		expect(noTargets.feedback).toContain("Put what?");

		const oneTarget = executeAction(bus, world, state, "put", { objects: ["sword"] });
		expect(oneTarget.stopped).toBe(true);
		expect(oneTarget.feedback).toContain("Where do you want to put it?");
	});

	it("put blocked when player is dead", () => {
		const { world, bus, state } = setup();
		const deadState = immutable(state, (s) => {
			s.player.state.dead = true;
		});
		const result = executeAction(bus, world, deadState, "put", {
			objects: ["sword", "chest"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("Your hand passes through its object.");
	});

	it("put moves object from inventory onto the floor", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "put", {
			objects: ["sword", "floor"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.objects.sword.location).toBe("room_a");
		expect(isInInventory(result.state, "sword")).toBe(false);
		expect(result.feedback).toContain("You put the iron sword on the floor.");
	});

	it("put moves object from open container onto the ground", () => {
		const { world, bus, state } = setup();
		const openResult = executeAction(bus, world, state, "open", { objects: ["chest"] });
		const result = executeAction(bus, world, openResult.state, "put", {
			objects: ["gem", "ground"],
		});

		expect(result.stopped).toBe(false);
		expect(result.state.objects.gem.location).toBe("room_a");
		expect(result.feedback).toContain("You put the red gem on the floor.");
	});

	it("put blocked when object is already on the floor", () => {
		const { world, bus, state } = setup();
		// lamp is already in room_a
		const result = executeAction(bus, world, state, "put", {
			objects: ["lamp", "floor"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("The brass lamp is already on the floor.");
	});

	it("GameEngine allows putting on floor without failing in-scope checks", () => {
		const engine = new GameEngine(makeTestWorld());
		const response = engine.runAction({
			action: "put",
			objects: ["sword", "floor"],
			preposition: "on",
			direction: null,
			message: null,
		});
		expect(response).toContain("You put the iron sword on the floor.");
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
		state = immutable(state, (s) => setObjectState(s, "chest", "open", true));

		const result = executeAction(bus, world, state, "open", {
			objects: ["chest"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("It's already open.");
	});

	it("open returns failure for non-openable objects", () => {
		const { world, bus, state } = setup();
		state.objects.table.location = "room_a";
		const result = executeAction(bus, world, state, "open", {
			objects: ["table"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("You can't open that.");
	});

	it("custom guard rule can intercept open for specific object", () => {
		const { world, bus, state } = setup();
		state.objects.table.location = "room_a";
		bus.on(
			"open",
			"table",
			(event) => {
				event.stop();
				return "The table cannot be opened.";
			},
			{ priority: PRIORITY.GUARD },
		);
		const result = executeAction(bus, world, state, "open", {
			objects: ["table"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("The table cannot be opened.");
	});

	// ── close ─────────────────────────────────────────────────────────────

	it("close sets open=false", () => {
		const { world, bus } = setup();
		let { state } = setup();
		// First open the chest
		state = immutable(state, (s) => setObjectState(s, "chest", "open", true));

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
		expect(result.feedback.join("\n")).toContain("You are in room B.");
		expect(result.feedback.join("\n")).not.toContain("Room B again.");
		expect(result.state.rooms.room_b.state.visited).toBe(true);

		// Looking after entering now shows the visited description
		const lookAgain = executeAction(bus, world, result.state, "look", {});
		expect(lookAgain.feedback.join("\n")).toContain("Room B again.");
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

	it("look returns room description with objects", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "look", {});

		expect(result.stopped).toBe(false);
		expect(result.feedback.length).toBeGreaterThan(0);
		const text = result.feedback.join(" ");
		expect(text).toContain("Room A");
		expect(text).toContain("A brass lamp");
		expect(text).not.toContain("Exits:");
	});

	it("look excludes scenery objects from room listing", () => {
		const { world, bus, state } = setup();
		state.objects.lamp.state.scenery = true;
		const result = executeAction(bus, world, state, "look", {});

		expect(result.stopped).toBe(false);
		const text = result.feedback.join(" ");
		expect(text).toContain("Room A");
		expect(text).not.toContain("A brass lamp");
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
			objects: {
				...state.objects,
				sword: { ...state.objects.sword, location: "room_b" },
			},
		};

		const result = executeAction(bus, world, state, "inventory", {});

		expect(result.feedback.join(" ")).toContain("You aren't carrying anything.");
	});

	// ── attack ────────────────────────────────────────────────────────────

	it("attack with target gives default message", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "attack", {
			objects: ["lamp"],
		});

		expect(result.stopped).toBe(true);
		expect(result.feedback.join(" ")).toContain("has no effect");
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
