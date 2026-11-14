import { describe, expect, it } from "vitest";
import { tryDeterministicIntent } from "../agent/fast-path-parser";
import type { World } from "../world/types";
import { buildInitialState } from "./initial-state";
import { getPlayerVehicle, isInInventory, isInVehicle, isVehicle, movePlayer, setPlayerVehicle } from "./mutators";
import { evaluateCondition } from "./parser-context";
import { ActionRegistry } from "./rules/action-registry";
import { registerCoreActions } from "./rules/core-actions";
import { EventBus } from "./rules/event-bus";
import { executeAction } from "./rules/executor";
import { load, save } from "./save";

function createTestWorld(): World {
	return {
		id: "test_vehicle_world",
		name: "Vehicle Test World",
		version: "1.0.0",
		start_room: "dock",
		rooms: {
			dock: {
				id: "dock",
				name: "Wooden Dock",
				descriptions: { default: "A weathered wooden dock overlooking a lake." },
				state: { visited: false },
				exits: {
					north: {
						leads_to: "lake",
						condition: "player.vehicle == 'rowboat'",
						locked_message: "The water is too deep to swim across.",
					},
					south: {
						leads_to: "boathouse",
					},
				},
			},
			lake: {
				id: "lake",
				name: "Open Lake",
				descriptions: { default: "You are floating on the calm waters of the lake." },
				state: { visited: false },
				exits: {
					south: {
						leads_to: "dock",
					},
					north: {
						leads_to: "island",
					},
				},
			},
			island: {
				id: "island",
				name: "Small Island",
				descriptions: { default: "A secluded sandy island." },
				state: { visited: false },
				exits: {
					south: {
						leads_to: "lake",
						condition: "player.vehicle == 'rowboat'",
						locked_message: "You need a boat to return to the lake.",
					},
				},
			},
			boathouse: {
				id: "boathouse",
				name: "Boathouse",
				descriptions: { default: "A wooden shed for storing boats." },
				state: { visited: false },
				exits: {
					north: {
						leads_to: "dock",
					},
				},
			},
		},
		objects: {
			rowboat: {
				id: "rowboat",
				name: "wooden rowboat",
				aliases: ["boat", "rowboat"],
				type: "vehicle",
				location: "dock",
				state: { carriable: true, vehicle: true, open: true },
				descriptions: {
					default: "A sturdy wooden rowboat is tied to the dock.",
					enter: "You step into the rowboat and sit on the bench.",
					exit: "You step out of the rowboat onto the shore.",
				},
			},
			cart: {
				id: "cart",
				name: "wooden cart",
				aliases: ["cart", "wagon"],
				type: "vehicle",
				location: "dock",
				state: { carriable: false, vehicle: true, punctured: true },
				descriptions: {
					default: "A broken wooden cart with a broken wheel.",
				},
			},
			rock: {
				id: "rock",
				name: "heavy rock",
				aliases: ["stone"],
				type: "item",
				location: "dock",
				state: { carriable: true },
				descriptions: {
					default: "A smooth river rock.",
				},
			},
		},
		player: {
			current_room: "dock",
			capacity: 7,
			state: {},
		},
	};
}

function setup() {
	const world = createTestWorld();
	const bus = new EventBus();
	const registry = new ActionRegistry();
	registerCoreActions(bus, registry);
	const state = buildInitialState(world);
	return { world, bus, registry, state };
}

describe("Vehicles - Engine Core", () => {
	it("initializes player with null vehicle", () => {
		const { state } = setup();
		expect(state.player.vehicle).toBeNull();
		expect(getPlayerVehicle(state)).toBeNull();
		expect(isInVehicle(state)).toBe(false);
	});

	it("identifies vehicles using isVehicle helper", () => {
		const { world, state } = setup();
		expect(isVehicle(world.objects.rowboat, state.objects.rowboat)).toBe(true);
		expect(isVehicle(world.objects.rock, state.objects.rock)).toBe(false);
	});

	it("boards a vehicle with enter/board action", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "enter", { objects: ["rowboat"] });
		expect(result.stopped).toBe(false);
		expect(result.feedback.join(" ")).toContain("You step into the rowboat and sit on the bench.");
		expect(result.state.player.vehicle).toBe("rowboat");
		expect(result.state.player.state.vehicle).toBe("rowboat");
		expect(getPlayerVehicle(result.state)).toBe("rowboat");
		expect(isInVehicle(result.state)).toBe(true);
	});

	it("boards vehicle using alias", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "enter", { objects: ["boat"] });
		expect(result.stopped).toBe(false);
		expect(result.state.player.vehicle).toBe("rowboat");
	});

	it("enters single available vehicle when no target specified", () => {
		const { world, bus, state } = setup();
		// Move cart away so only rowboat is in dock
		state.objects.cart.location = "boathouse";
		const result = executeAction(bus, world, state, "enter", {});
		expect(result.stopped).toBe(false);
		expect(result.state.player.vehicle).toBe("rowboat");
	});

	it("rejects entering when multiple vehicles exist and none specified", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "enter", {});
		expect(result.stopped).toBe(true);
		expect(result.feedback.join(" ")).toContain("Which vehicle do you want to enter?");
	});

	it("rejects entering a non-vehicle object", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "enter", { objects: ["rock"] });
		expect(result.stopped).toBe(true);
		expect(result.feedback.join(" ")).toContain("You can't enter that.");
	});

	it("rejects entering an object that is not present", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "enter", { objects: ["spaceship"] });
		expect(result.stopped).toBe(true);
		expect(result.feedback.join(" ")).toContain("You don't see that here.");
	});

	it("rejects entering a punctured or unusable vehicle", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "enter", { objects: ["cart"] });
		expect(result.stopped).toBe(true);
		expect(result.feedback.join(" ")).toContain("It is punctured and unusable.");
	});

	it("rejects entering a vehicle when already inside one", () => {
		const { world, bus, state } = setup();
		setPlayerVehicle(state, "rowboat");
		const result = executeAction(bus, world, state, "enter", { objects: ["rowboat"] });
		expect(result.stopped).toBe(true);
		expect(result.feedback.join(" ")).toContain("You are already in the wooden rowboat.");
	});

	it("disembarks a vehicle with exit/leave action", () => {
		const { world, bus, state } = setup();
		setPlayerVehicle(state, "rowboat");
		const result = executeAction(bus, world, state, "exit", {});
		expect(result.stopped).toBe(false);
		expect(result.feedback.join(" ")).toContain("You step out of the rowboat onto the shore.");
		expect(result.state.player.vehicle).toBeNull();
		expect(result.state.player.state.vehicle).toBeUndefined();
		expect(isInVehicle(result.state)).toBe(false);
	});

	it("disembarks specifying the vehicle name or alias", () => {
		const { world, bus, state } = setup();
		setPlayerVehicle(state, "rowboat");
		const result = executeAction(bus, world, state, "exit", { objects: ["boat"] });
		expect(result.stopped).toBe(false);
		expect(result.state.player.vehicle).toBeNull();
	});

	it("rejects exit if wrong vehicle name is given", () => {
		const { world, bus, state } = setup();
		setPlayerVehicle(state, "rowboat");
		const result = executeAction(bus, world, state, "exit", { objects: ["cart"] });
		expect(result.stopped).toBe(true);
		expect(result.feedback.join(" ")).toContain("You aren't in the cart.");
		expect(result.state.player.vehicle).toBe("rowboat");
	});

	it("rejects exit if player is not in any vehicle", () => {
		const { world, bus, state } = setup();
		const result = executeAction(bus, world, state, "exit", {});
		expect(result.stopped).toBe(true);
		expect(result.feedback.join(" ")).toContain("You aren't in a vehicle.");
	});

	it("moves vehicle with player when navigating with go", () => {
		const { world, bus, state } = setup();
		setPlayerVehicle(state, "rowboat");
		expect(state.player.current_room).toBe("dock");
		expect(state.objects.rowboat.location).toBe("dock");

		const result = executeAction(bus, world, state, "go", { direction: "north" });
		expect(result.stopped).toBe(false);
		expect(result.state.player.current_room).toBe("lake");
		expect(result.state.objects.rowboat.location).toBe("lake");
		expect(result.state.player.vehicle).toBe("rowboat");
	});

	it("movePlayer mutator moves both player and vehicle", () => {
		const { state } = setup();
		setPlayerVehicle(state, "rowboat");
		movePlayer(state, "boathouse");
		expect(state.player.current_room).toBe("boathouse");
		expect(state.objects.rowboat.location).toBe("boathouse");
	});

	it("prevents taking the vehicle while player is inside it", () => {
		const { world, bus, state } = setup();
		setPlayerVehicle(state, "rowboat");
		const result = executeAction(bus, world, state, "take", { objects: ["rowboat"] });
		expect(result.stopped).toBe(true);
		expect(result.feedback.join(" ")).toContain("You can't take that while you're inside it.");
		expect(isInInventory(result.state, "rowboat")).toBe(false);
	});

	it("allows taking the vehicle after exiting it", () => {
		const { world, bus, state } = setup();
		setPlayerVehicle(state, "rowboat");
		const exitRes = executeAction(bus, world, state, "exit", {});
		const takeRes = executeAction(bus, world, exitRes.state, "take", { objects: ["rowboat"] });
		expect(takeRes.stopped).toBe(false);
		expect(isInInventory(takeRes.state, "rowboat")).toBe(true);
	});
});

describe("Vehicles - Exit Conditions & Evaluation", () => {
	it("evaluates player.vehicle condition accurately", () => {
		const { state } = setup();
		expect(evaluateCondition("player.vehicle == 'rowboat'", state)).toBe(false);
		expect(evaluateCondition("player.vehicle != 'rowboat'", state)).toBe(true);
		expect(evaluateCondition("player.vehicle == null", state)).toBe(true);

		setPlayerVehicle(state, "rowboat");
		expect(evaluateCondition("player.vehicle == 'rowboat'", state)).toBe(true);
		expect(evaluateCondition("player.vehicle == rowboat", state)).toBe(true);
		expect(evaluateCondition("player.vehicle != 'rowboat'", state)).toBe(false);
		expect(evaluateCondition("player.vehicle == null", state)).toBe(false);
	});

	it("blocks exit navigation when vehicle condition is not met", () => {
		const { world, bus, state } = setup();
		// Player on foot at dock trying to go north to lake
		const result = executeAction(bus, world, state, "go", { direction: "north" });
		expect(result.stopped).toBe(true);
		expect(result.feedback.join(" ")).toContain("The water is too deep to swim across.");
		expect(result.state.player.current_room).toBe("dock");
	});

	it("allows exit navigation when vehicle condition is met", () => {
		const { world, bus, state } = setup();
		// Board rowboat first
		const boardRes = executeAction(bus, world, state, "enter", { objects: ["rowboat"] });
		// Now go north into lake
		const goRes = executeAction(bus, world, boardRes.state, "go", { direction: "north" });
		expect(goRes.stopped).toBe(false);
		expect(goRes.state.player.current_room).toBe("lake");
		expect(goRes.state.objects.rowboat.location).toBe("lake");
	});
});

describe("Vehicles - Fast-Path Parser", () => {
	it("parses single-word exit commands", () => {
		expect(tryDeterministicIntent("exit")).toEqual({
			action: "exit",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("disembark")?.action).toBe("exit");
		expect(tryDeterministicIntent("leave")?.action).toBe("exit");
		expect(tryDeterministicIntent("get out")?.action).toBe("exit");
	});

	it("parses exit with entity target", () => {
		expect(tryDeterministicIntent("exit boat")).toEqual({
			action: "exit",
			direction: null,
			objects: ["boat"],
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("disembark the rowboat")).toEqual({
			action: "exit",
			direction: null,
			objects: ["rowboat"],
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("get out of the boat")?.action).toBe("exit");
	});

	it("parses single-word enter commands", () => {
		expect(tryDeterministicIntent("enter")).toEqual({
			action: "enter",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("board")?.action).toBe("enter");
		expect(tryDeterministicIntent("embark")?.action).toBe("enter");
		expect(tryDeterministicIntent("get in")?.action).toBe("enter");
	});

	it("parses enter with entity target", () => {
		expect(tryDeterministicIntent("board boat")).toEqual({
			action: "enter",
			direction: null,
			objects: ["boat"],
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("enter the vehicle")).toEqual({
			action: "enter",
			direction: null,
			objects: ["vehicle"],
			preposition: null,
			message: null,
		});
		expect(tryDeterministicIntent("get into the rowboat")?.action).toBe("enter");
	});

	it("preserves quit for q and quit without hijacking exit", () => {
		expect(tryDeterministicIntent("q")?.action).toBe("quit");
		expect(tryDeterministicIntent("quit")?.action).toBe("quit");
		expect(tryDeterministicIntent("exit")?.action).toBe("exit");
	});
});

describe("Vehicles - Save and Restore Persistence", () => {
	it("persists and restores vehicle state cleanly", () => {
		const { state } = setup();
		setPlayerVehicle(state, "rowboat");
		state.player.current_room = "lake";
		state.objects.rowboat.location = "lake";

		const saved = save(state);
		const restored = load(saved);

		expect(restored.player.vehicle).toBe("rowboat");
		expect(restored.player.state.vehicle).toBe("rowboat");
		expect(getPlayerVehicle(restored)).toBe("rowboat");
		expect(isInVehicle(restored)).toBe(true);
		expect(restored.player.current_room).toBe("lake");
		expect(restored.objects.rowboat.location).toBe("lake");
	});
});
