import { isInInventory, setObjectState } from "../src/engine/mutators";
import { executeAction, type GameSetup, PRIORITY, registerDaemon } from "../src/engine/rules";
import type { GameState } from "../src/engine/types";
import type { World } from "../src/world/types";

const world: World = {
	id: "troll",
	name: "Zork One - The Troll",
	version: "1.0.0",
	start_room: "cellar",
	rooms: {
		cellar: {
			id: "cellar",
			name: "Cellar",
			descriptions: {
				default: "You are in a dark, musty cellar. A narrow passage leads east into darkness.",
			},
			state: {},
			exits: { east: { leads_to: "troll_cave" } },
			contains: ["metal_sword", "wooden_sword"],
		},
		troll_cave: {
			id: "troll_cave",
			name: "Troll Cave",
			descriptions: {
				default:
					"You are in a damp cave. The air smells foul. A passage leads west back to the cellar, and a narrow crack to the north leads deeper underground.",
			},
			state: {},
			exits: {
				west: { leads_to: "cellar" },
				north: {
					leads_to: "treasure_room",
					condition: "troll.knocked_out == true",
					locked_message: "The troll blocks your way north with a menacing snarl!",
				},
			},
			contains: ["troll"],
		},
		treasure_room: {
			id: "treasure_room",
			name: "Treasure Room",
			descriptions: {
				default:
					"A glittering chamber filled with gold coins and precious gems. You have found the troll's treasure hoard!",
			},
			state: {},
			exits: { south: { leads_to: "troll_cave" } },
			contains: ["gold_coins"],
		},
	},
	objects: {
		troll: {
			id: "troll",
			name: "troll",
			descriptions: {
				default: "A large, nasty-looking troll stands before you, brandishing a bloody axe. He snarls menacingly.",
				"knocked_out == true": "The troll lies unconscious on the ground, drooling slightly.",
			},
			type: "actor",
			state: { alive: true, knocked_out: false, carriable: false },
			synonyms: ["troll", "monster", "creature"],
		},
		metal_sword: {
			id: "metal_sword",
			name: "metal sword",
			synonyms: ["sword", "weapon", "blade", "sharp sword"],
			type: "weapon",
			state: { carriable: true },
			descriptions: {
				default: "A well-forged metal sword. Its edge gleams dangerously in the light.",
			},
		},
		wooden_sword: {
			id: "wooden_sword",
			name: "wooden sword",
			synonyms: ["weapon", "blade", "training sword", "practice sword"],
			type: "weapon",
			state: { carriable: true },
			descriptions: {
				default: "A blunt training sword made of wood. It would barely bruise an apple.",
			},
		},
		gold_coins: {
			id: "gold_coins",
			name: "pile of gold coins",
			synonyms: ["gold", "coins", "treasure", "pile"],
			type: "item",
			state: { carriable: true },
			descriptions: {
				default: "A glittering pile of gold coins, each stamped with a strange rune.",
			},
		},
	},
	player: {
		current_room: "cellar",
		inventory: [],
		state: {},
	},
};

export default world;

function isTrollNearby(state: GameState, world: World): boolean {
	const currentRoom = state.player.current_room;
	const troll = world.objects.troll;

	return (
		world.rooms[currentRoom].contains?.includes(troll.id) ||
		Object.values(world.rooms[currentRoom].exits).some((exit) => {
			if (world.rooms[exit.leads_to].contains?.includes(troll.id)) {
				return true;
			}
			return false;
		})
	);
}

export const setup: GameSetup = (bus) => {
	// ── attack troll ──────────────────────────────────────────────────────
	bus.on("attack", "troll", (event, state, world) => {
		const troll = state.objects.troll;
		if (troll?.state.knocked_out === true) {
			event.stop("The troll is already unconscious. No need for further violence.");
			return state;
		}

		const weapon = (event.params.objects as string[])?.[1];
		const hasMetalSword = isInInventory(state, "metal_sword");
		const hasWoodenSword = isInInventory(state, "wooden_sword");

		// No weapon specified
		if (!weapon) {
			if (!hasMetalSword && !hasWoodenSword) {
				const result = executeAction(bus, world, state, "die", {});
				event.stop(["You swing your fists at the troll. He laughs and shoves you back.", ...result.feedback]);
				return result.state;
			}
			// Auto-pick best weapon
			if (hasMetalSword) {
				const nextState = setObjectState(state, "troll", "knocked_out", true);
				return {
					state: nextState,
					feedback: [
						"You swing the metal sword in a wide arc. It connects with the troll's head with a satisfying clang! The troll staggers, then collapses to the ground, unconscious.",
					],
				};
			}
			return {
				state,
				feedback: [
					"You whack the troll with the wooden sword. It splinters on impact. The troll barely notices and swats you away.",
				],
			};
		}

		// Specific weapon
		if (weapon === "metal_sword" && isInInventory(state, "metal_sword")) {
			const nextState = setObjectState(state, "troll", "knocked_out", true);
			return {
				state: nextState,
				feedback: [
					"You swing the metal sword in a wide arc. It connects with the troll's head with a satisfying clang! The troll staggers, then collapses to the ground, unconscious.",
				],
			};
		}

		if (weapon === "wooden_sword" && isInInventory(state, "wooden_sword")) {
			return {
				state,
				feedback: [
					"You whack the troll with the wooden sword. It splinters on impact. The troll barely notices and swats you away.",
				],
			};
		}

		event.stop("You don't have that weapon.");
		return state;
	});

	// ── talk to troll ─────────────────────────────────────────────────────
	bus.on("talk", "troll", (event, state) => {
		const troll = state.objects.troll;
		if (troll?.state.knocked_out === true) {
			event.stop("The troll is unconscious. It snores loudly.");
			return state;
		}
		event.stop('The troll grunts: "Me no talk. Me SMASH!"');
		return state;
	});

	// ── intercept take ─────────────────────────────────────────────────────

	bus.on(
		"take",
		(event, state) => {
			if (state.player.state.dead) {
				event.stop("You are dead. You cannot take anything.");
				return state;
			}
			return state;
		},
		{ priority: PRIORITY.GUARD },
	);

	// ── troll attacks back each turn ──────────────────────────────────────
	registerDaemon(bus, "troll-counter-attack", {
		condition: (_, state) =>
			!state.player.state.dead &&
			state.player.current_room === "troll_cave" &&
			state.objects.troll?.state.knocked_out !== true,
		effect: (_, state) => state,
		feedback: () => "\nThe troll swings his axe at you! You barely dodge in time.",
		priority: PRIORITY.POST_MUTATION,
	});

	registerDaemon(bus, "sword-glow-effect", {
		condition: (world, state) => {
			return !state.player.state.dead && isInInventory(state, "metal_sword") && isTrollNearby(state, world);
		},
		effect: (_, state) => state,
		feedback: () => "The sword glows with a green light.",
		priority: PRIORITY.POST_MUTATION,
	});
};
