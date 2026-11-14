import { describe, expect, it } from "vitest";
import { tryDeterministicIntent } from "../agent/fast-path-parser";
import type { World } from "../world/types";
import { GameEngine } from "./game-engine";
import { buildInitialState } from "./initial-state";
import { ensureVisited, immutable, moveObject } from "./mutators";
import { ActionRegistry } from "./rules/action-registry";
import { registerCoreActions, standardAdventureActions } from "./rules/core-actions";
import { EventBus } from "./rules/event-bus";
import { executeAction } from "./rules/executor";
import {
	addScore,
	calculateMaxScore,
	calculateScore,
	getScore,
	isDepositedInTrophy,
	isPossessedByPlayer,
	isTrophyLocation,
	syncScore,
} from "./score";

function makeScoredWorld(): World {
	return {
		id: "scored_world",
		name: "Scored Adventure",
		version: "1.0.0",
		start_room: "foyer",
		rooms: {
			foyer: {
				id: "foyer",
				name: "The Foyer",
				descriptions: { default: "An empty foyer." },
				state: { visited: false },
				exits: {
					north: { leads_to: "vault" },
					east: { leads_to: "trophy_room" },
				},
			},
			vault: {
				id: "vault",
				name: "Ancient Vault",
				value: 25,
				descriptions: { default: "A glittering treasure vault." },
				state: { visited: false },
				exits: {
					south: { leads_to: "foyer" },
				},
			},
			trophy_room: {
				id: "trophy_room",
				name: "Trophy Room",
				is_trophy: true,
				descriptions: { default: "A grand hall meant for displaying treasures." },
				state: { visited: false },
				exits: {
					west: { leads_to: "foyer" },
				},
			},
		},
		objects: {
			chalice: {
				id: "chalice",
				name: "golden chalice",
				aliases: [],
				type: "item",
				location: "vault",
				value: 15,
				descriptions: { default: "A golden chalice encrusted with rubies." },
				state: { carriable: true },
			},
			crown: {
				id: "crown",
				name: "jeweled crown",
				aliases: [],
				type: "item",
				location: "vault",
				value: 20,
				deposit_value: 30,
				descriptions: { default: "A majestic royal crown." },
				state: { carriable: true },
			},
			relic: {
				id: "relic",
				name: "ancient relic",
				aliases: [],
				type: "item",
				location: "vault",
				deposit_value: 10,
				descriptions: { default: "A holy relic meant for the trophy room." },
				state: { carriable: true },
			},
			trophy_case: {
				id: "trophy_case",
				name: "glass trophy case",
				aliases: [],
				type: "container",
				location: "foyer",
				is_trophy: true,
				descriptions: { default: "A glass case with velvet lining." },
				state: { carriable: false, open: true },
			},
			pouch: {
				id: "pouch",
				name: "leather pouch",
				aliases: [],
				type: "container",
				location: "foyer",
				descriptions: { default: "A small leather pouch." },
				state: { carriable: true, open: true },
			},
			gem: {
				id: "gem",
				name: "sparkling gem",
				aliases: [],
				type: "item",
				location: "pouch",
				value: 5,
				descriptions: { default: "A sparkling cut gem." },
				state: { carriable: true },
			},
		},
		player: {
			current_room: "foyer",
			state: {},
		},
	};
}

describe("Scoring calculations", () => {
	it("calculates room values only when visited", () => {
		const world = makeScoredWorld();
		const state = buildInitialState(world);

		// Initial: vault not visited
		expect(calculateScore(world, state)).toBe(0);

		// Visit vault
		ensureVisited(state, "vault");
		expect(calculateScore(world, state)).toBe(25);
	});

	it("calculates object values when possessed in inventory", () => {
		const world = makeScoredWorld();
		const state = buildInitialState(world);

		// Move chalice to inventory
		moveObject(state, "chalice", "inventory");
		expect(calculateScore(world, state)).toBe(15);

		// Move crown to inventory (value = 20, deposit_value = 30; when in inventory, awards value)
		moveObject(state, "crown", "inventory");
		expect(calculateScore(world, state)).toBe(35);

		// Relic only has deposit_value (10), so inventory gives 0
		moveObject(state, "relic", "inventory");
		expect(calculateScore(world, state)).toBe(35);

		// Dropping chalice back to foyer loses points
		moveObject(state, "chalice", "foyer");
		expect(calculateScore(world, state)).toBe(20);
	});

	it("handles nested inventory possession via containers", () => {
		const world = makeScoredWorld();
		const state = buildInitialState(world);

		// Gem is in pouch in foyer: not possessed
		expect(isPossessedByPlayer(state, "gem")).toBe(false);
		expect(calculateScore(world, state)).toBe(0);

		// Pick up pouch
		moveObject(state, "pouch", "inventory");
		expect(isPossessedByPlayer(state, "gem")).toBe(true);
		expect(calculateScore(world, state)).toBe(5);
	});

	it("identifies trophy locations and deposited treasures", () => {
		const world = makeScoredWorld();
		const state = buildInitialState(world);

		expect(isTrophyLocation(world, state, "trophy_room")).toBe(true);
		expect(isTrophyLocation(world, state, "trophy_case")).toBe(true);
		expect(isTrophyLocation(world, state, "foyer")).toBe(false);

		// Depositing crown into trophy_room: gets value (20) + deposit_value (30) = 50
		moveObject(state, "crown", "trophy_room");
		expect(isDepositedInTrophy(world, state, "crown")).toBe(true);
		expect(calculateScore(world, state)).toBe(50);

		// Depositing relic into trophy_case: gets deposit_value (10)
		moveObject(state, "relic", "trophy_case");
		expect(isDepositedInTrophy(world, state, "relic")).toBe(true);
		expect(calculateScore(world, state)).toBe(60);

		// Depositing container with gem into trophy case
		moveObject(state, "pouch", "trophy_case");
		expect(isDepositedInTrophy(world, state, "gem")).toBe(true);
		expect(calculateScore(world, state)).toBe(65);
	});

	it("supports take_value for one-time pick up points", () => {
		const world = makeScoredWorld();
		world.objects.chalice.take_value = 5;
		const state = buildInitialState(world);

		// Mark chalice takenOnce
		state.objects.chalice.state.takenOnce = true;
		state.objects.chalice.location = "foyer"; // Dropped in non-trophy room

		// Gets take_value even though dropped
		expect(calculateScore(world, state)).toBe(5);

		// If picked back up into inventory: gets take_value (5) + value (15) = 20
		state.objects.chalice.location = "inventory";
		expect(calculateScore(world, state)).toBe(20);
	});

	it("calculates maximum attainable score", () => {
		const world = makeScoredWorld();
		// vault (25) + chalice (15) + crown (20 + 30 = 50) + relic (10) + gem (5) = 105
		expect(calculateMaxScore(world)).toBe(105);

		// Custom world.max_score overrides sum
		world.max_score = 200;
		expect(calculateMaxScore(world)).toBe(200);
	});

	it("synchronizes score and max_score into player state", () => {
		const world = makeScoredWorld();
		const state = buildInitialState(world);

		ensureVisited(state, "vault");
		moveObject(state, "chalice", "inventory");

		syncScore(world, state);
		expect(state.player.state.score).toBe(40);
		expect(state.player.state.max_score).toBe(105);

		// Add bonus
		addScore(state, 10);
		expect(calculateScore(world, state)).toBe(50);
		syncScore(world, state);
		expect(state.player.state.score).toBe(50);
	});

	it("supports state-level values as fallback", () => {
		const world: World = {
			id: "state_val_world",
			name: "State Values",
			version: "1.0.0",
			start_room: "start",
			rooms: {
				start: {
					id: "start",
					name: "Start",
					descriptions: { default: "Start" },
					state: { value: 10, visited: true },
					exits: {},
				},
			},
			objects: {
				orb: {
					id: "orb",
					name: "orb",
					aliases: [],
					type: "item",
					location: "inventory",
					descriptions: { default: "Orb" },
					state: { value: 20 },
				},
			},
			player: { current_room: "start", state: {} },
		};
		const state = buildInitialState(world);
		expect(calculateScore(world, state)).toBe(30);
		expect(calculateMaxScore(world)).toBe(30);
	});
});

describe("Score action command", () => {
	function setup() {
		const bus = new EventBus();
		const registry = new ActionRegistry();
		registerCoreActions(bus, registry);
		const world = makeScoredWorld();
		const state = buildInitialState(world);
		return { bus, registry, world, state };
	}

	it("reports current score, max points, and moves", () => {
		const { bus, world, state } = setup();

		const res0 = executeAction(bus, world, state, "score", {});
		expect(res0.feedback).toEqual(["Your score is 0 of a possible 105 points, in 0 moves."]);

		// Visit vault and take chalice
		let s = immutable(state, (draft) => {
			ensureVisited(draft, "vault");
			moveObject(draft, "chalice", "inventory");
			draft.turn = 3;
		});

		const res1 = executeAction(bus, world, s, "score", {});
		expect(res1.feedback).toEqual(["Your score is 40 of a possible 105 points, in 3 moves."]);

		// Single move singular form
		s = immutable(s, (draft) => {
			draft.turn = 1;
		});
		const res2 = executeAction(bus, world, s, "score", {});
		expect(res2.feedback).toEqual(["Your score is 40 of a possible 105 points, in 1 move."]);
	});

	it("rejects scoring when player is dead", () => {
		const { bus, world, state } = setup();
		state.player.state.dead = true;

		const res = executeAction(bus, world, state, "score", {});
		expect(res.feedback).toEqual(["How can you think of your score in your condition?"]);
	});

	it("fast-path parser recognizes score, points, and sc", () => {
		expect(tryDeterministicIntent("score")).toEqual({
			action: "score",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});

		expect(tryDeterministicIntent("points")).toEqual({
			action: "score",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});

		expect(tryDeterministicIntent("sc")).toEqual({
			action: "score",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});

		expect(tryDeterministicIntent("  SCORE  ")).toEqual({
			action: "score",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		});
	});
});

describe("GameEngine integration and turn lifecycle scoring", () => {
	it("initializes and updates score dynamically across gameplay turns", () => {
		const world = makeScoredWorld();
		const engine = new GameEngine(world);

		// Start game
		engine.start();
		expect(engine.getScore()).toEqual({ score: 0, maxScore: 105 });

		// Go north to vault
		const goVaultRes = engine.runAction({ action: "go", direction: "north" });
		expect(goVaultRes).toContain("Ancient Vault");
		// Vault is visited (25 points)
		expect(engine.getScore().score).toBe(25);

		// Take chalice (value 15)
		const takeRes = engine.runAction({ action: "take", objects: ["chalice"] });
		expect(takeRes).toContain("Taken.");
		expect(engine.getScore().score).toBe(40);

		// Score command check
		const scoreRes = engine.runAction({ action: "score" });
		expect(scoreRes).toContain("Your score is 40 of a possible 105 points");

		// Take crown (value 20, deposit 30)
		engine.runAction({ action: "take", objects: ["crown"] });
		expect(engine.getScore().score).toBe(60);

		// Go south to foyer, east to trophy_room
		engine.runAction({ action: "go", direction: "south" });
		engine.runAction({ action: "go", direction: "east" });

		// Put crown in trophy room (drop it)
		engine.runAction({ action: "drop", objects: ["crown"] });
		// Crown in trophy room gets value (20) + deposit_value (30) = 50.
		// Total: vault (25) + chalice in inventory (15) + crown deposited (50) = 90
		expect(engine.getScore().score).toBe(90);

		// Undo the drop
		engine.runAction({ action: "undo" });
		// Crown back in inventory -> score is 60 again
		expect(engine.getScore().score).toBe(60);
	});

	it("preserves score across save and restore", () => {
		const world = makeScoredWorld();
		const engine1 = new GameEngine(world);

		engine1.start();
		engine1.runAction({ action: "go", direction: "north" });
		engine1.runAction({ action: "take", objects: ["chalice"] });

		expect(engine1.getScore().score).toBe(40);
		const saved = engine1.save();

		// New engine restores save
		const engine2 = new GameEngine(world);
		engine2.restore(saved);
		expect(engine2.getScore().score).toBe(40);
		const scoreRes = engine2.runAction({ action: "score" });
		expect(scoreRes).toContain("40 of a possible 105 points");
	});
});
