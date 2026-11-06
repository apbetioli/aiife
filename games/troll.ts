import {
	defineGame,
	type GameState,
	isInInventory,
	PRIORITY,
	registerDaemon,
	runAction,
	setObjectState,
	type World,
} from "../src/sdk";

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
			location: "troll_cave",
			state: { alive: true, knocked_out: false, carriable: false },
			aliases: [],
		},
		metal_sword: {
			id: "metal_sword",
			name: "metal sword",
			aliases: [],
			type: "weapon",
			location: "cellar",
			state: { carriable: true },
			descriptions: {
				default: "A well-forged metal sword. Its edge gleams dangerously in the light.",
			},
		},
		wooden_sword: {
			id: "wooden_sword",
			name: "wooden sword",
			aliases: ["training sword", "practice sword"],
			type: "weapon",
			location: "cellar",
			state: { carriable: true },
			descriptions: {
				default: "A blunt training sword made of wood. It would barely bruise an apple.",
			},
		},
		gold_coins: {
			id: "gold_coins",
			name: "pile of gold coins",
			aliases: ["treasure"],
			type: "item",
			location: "treasure_room",
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

function isTrollNearby(state: GameState, world: World): boolean {
	const currentRoom = state.player.current_room;
	const trollLocation = state.objects.troll?.location ?? world.objects.troll.location;

	return (
		trollLocation === currentRoom ||
		Object.values(world.rooms[currentRoom].exits).some((exit) => exit.leads_to === trollLocation)
	);
}

export default defineGame({
	world,
	setup(bus) {
		// ── attack troll ──────────────────────────────────────────────────────
		bus.on("attack", "troll", (event, state, world) => {
			const troll = state.objects.troll;
			if (troll?.state.knocked_out === true) {
				event.stop();
				return "The troll is already unconscious. No need for further violence.";
			}

			const weapon = (event.params.objects as string[])?.[1];
			const hasMetalSword = isInInventory(state, "metal_sword");
			const hasWoodenSword = isInInventory(state, "wooden_sword");

			// No weapon specified
			if (!weapon) {
				if (!hasMetalSword && !hasWoodenSword) {
					const dieFeedback = runAction(bus, world, state, "die", {});
					event.stop();
					return ["You swing your fists at the troll. He laughs and shoves you back.", ...dieFeedback];
				}
				// Auto-pick best weapon
				if (hasMetalSword) {
					setObjectState(state, "troll", "knocked_out", true);
					event.stop();
					return "You swing the metal sword in a wide arc. It connects with the troll's head with a satisfying clang! The troll staggers, then collapses to the ground, unconscious.";
				}
				event.stop();
				return "You whack the troll with the wooden sword. It splinters on impact. The troll barely notices and swats you away.";
			}

			// Specific weapon
			if (weapon === "metal_sword" && isInInventory(state, "metal_sword")) {
				setObjectState(state, "troll", "knocked_out", true);
				event.stop();
				return "You swing the metal sword in a wide arc. It connects with the troll's head with a satisfying clang! The troll staggers, then collapses to the ground, unconscious.";
			}

			if (weapon === "wooden_sword" && isInInventory(state, "wooden_sword")) {
				event.stop();
				return "You whack the troll with the wooden sword. It splinters on impact. The troll barely notices and swats you away.";
			}

			event.stop();
			return "You don't have that weapon.";
		});

		// ── talk to troll ─────────────────────────────────────────────────────
		bus.on("talk", "troll", (event, state) => {
			const troll = state.objects.troll;
			if (troll?.state.knocked_out === true) {
				event.stop();
				return "The troll is unconscious. It snores loudly.";
			}
			event.stop();
			return 'The troll grunts: "Me no talk. Me SMASH!"';
		});

		// ── troll attacks back each turn ──────────────────────────────────────
		registerDaemon(bus, "troll-counter-attack", {
			condition: (_, state) =>
				!state.player.state.dead &&
				state.player.current_room === "troll_cave" &&
				state.objects.troll?.state.knocked_out !== true,
			effect: () => {},
			feedback: () => "\nThe troll swings his axe at you! You barely dodge in time.",
			priority: PRIORITY.POST_MUTATION,
		});

		registerDaemon(bus, "sword-glow-effect", {
			condition: (world, state) => {
				return !state.player.state.dead && isInInventory(state, "metal_sword") && isTrollNearby(state, world);
			},
			effect: () => {},
			feedback: () => "The sword glows with a green light.",
			priority: PRIORITY.POST_MUTATION,
		});
	},
});
