import {
	defineGame,
	isInInventory,
	moveObject,
	PRIORITY,
	registerDaemon,
	runAction,
	setObjectState,
	setPlayerState,
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
			name: "The Troll Room",
			descriptions: {
				default:
					"This is a small room with passages to the east and south and a forbidding hole leading west. Bloodstains and deep scratches (perhaps made by an axe) mar the walls.",
			},
			state: {},
			exits: {
				west: { leads_to: "cellar" },
				north: {
					leads_to: "treasure_room",
					condition: "troll.knocked_out == true || troll.dead == true",
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
				default: "A nasty-looking troll, brandishing a bloody axe, blocks all passages out of the room.",
				"knocked_out == true": "The troll lies unconscious on the ground, drooling slightly.",
				"dead == true": "The carcass of the troll has disappeared.",
			},
			type: "actor",
			location: "troll_cave",
			state: { alive: true, dead: false, knocked_out: false, carriable: false, combat_phase: 0 },
			aliases: ["nasty troll", "nasty-looking troll"],
		},
		metal_sword: {
			id: "metal_sword",
			name: "sword",
			aliases: ["metal sword", "sword"],
			type: "weapon",
			location: "cellar",
			state: { carriable: true },
			descriptions: {
				default: "A well-forged sword. Its edge gleams dangerously in the light.",
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
		state: {},
	},
};

const TROLL_COMBAT_SEQUENCE = [
	{
		phase: 0,
		playerMessage: "You are still recovering from that last blow, so your attack is ineffective.",
		counterMessage: "The troll's axe barely misses your ear.",
	},
	{
		phase: 1,
		playerMessage: "Clang! Crash! The troll parries.",
		counterMessage: "The troll's axe barely misses your ear.",
	},
	{
		phase: 2,
		playerMessage: "The troll is confused and can't fight back.",
		counterMessage: "The troll slowly regains his feet.",
	},
	{
		phase: 3,
		playerMessage: "The troll is knocked out!",
		knockedOut: true,
	},
	{
		phase: 4,
		playerMessage: "The unconscious troll cannot defend himself: He dies.",
		deathMessage:
			"Almost as soon as the troll breathes his last breath, a cloud of sinister black fog envelops him, and when the fog lifts, the carcass has disappeared.",
		swordMessage: "Your sword is no longer glowing.",
		dead: true,
	},
];

export default defineGame({
	world,
	setup(bus) {
		// ── attack troll ──────────────────────────────────────────────────────
		bus.on("attack", "troll", (event, state, world) => {
			const troll = state.objects.troll;
			if (troll?.state.dead === true) {
				event.stop();
				return "The troll is already dead.";
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
				if (!hasMetalSword && hasWoodenSword) {
					event.stop();
					return "You whack the troll with the wooden sword. It splinters on impact. The troll barely notices and swats you away.";
				}
			} else {
				if (weapon === "wooden_sword" && hasWoodenSword) {
					event.stop();
					return "You whack the troll with the wooden sword. It splinters on impact. The troll barely notices and swats you away.";
				}
				if (weapon !== "metal_sword" && weapon !== "sword") {
					event.stop();
					return "You don't have that weapon.";
				}
				if (!hasMetalSword) {
					event.stop();
					return "You don't have that weapon.";
				}
			}

			const phase = Number(troll?.state.combat_phase ?? 0);
			if (phase >= TROLL_COMBAT_SEQUENCE.length) {
				event.stop();
				return "The troll is already dead.";
			}

			const step = TROLL_COMBAT_SEQUENCE[phase];
			setObjectState(state, "troll", "combat_phase", phase + 1);

			if (step.knockedOut) {
				setObjectState(state, "troll", "knocked_out", true);
			}

			if (step.dead) {
				setObjectState(state, "troll", "dead", true);
				setObjectState(state, "troll", "alive", false);
				setObjectState(state, "troll", "knocked_out", false);
				moveObject(state, "troll", null);
			}

			event.stop();
			const feedback: string[] = [step.playerMessage];
			if (step.counterMessage) {
				feedback.push(step.counterMessage);
			}
			if (step.deathMessage) {
				feedback.push(step.deathMessage);
			}
			if (step.swordMessage) {
				feedback.push(step.swordMessage);
			}
			return feedback;
		});

		// ── Room entry surprise attack & sword glow ─────────────────────────────
		bus.on(
			"look",
			(_event, state) => {
				const room = state.player.current_room;
				const troll = state.objects.troll;
				if (room === "troll_cave" && !troll?.state.dead && !state.player.state.troll_encountered) {
					setPlayerState(state, "troll_encountered", true);
					setPlayerState(state, "staggered", true);
					const feedback: string[] = [];
					if (isInInventory(state, "metal_sword")) {
						feedback.push("Your sword has begun to glow very brightly.");
					}
					feedback.push("The troll's mighty blow drops you to your knees.");
					return feedback;
				}
			},
			{ priority: PRIORITY.POST_MUTATION },
		);

		// ── talk to troll ─────────────────────────────────────────────────────
		bus.on("talk", "troll", (event, state) => {
			const troll = state.objects.troll;
			if (troll?.state.dead === true) {
				event.stop();
				return "The troll is dead.";
			}
			if (troll?.state.knocked_out === true) {
				event.stop();
				return "The troll is unconscious. It snores loudly.";
			}
			event.stop();
			return 'The troll grunts: "Me no talk. Me SMASH!"';
		});

		// ── Sword glow faint in cellar ─────────────────────────────────────────
		registerDaemon(bus, "sword-glow-effect", {
			condition: (_world, state) => {
				return (
					!state.player.state.dead &&
					isInInventory(state, "metal_sword") &&
					state.player.current_room === "cellar" &&
					!state.objects.troll?.state.dead
				);
			},
			effect: () => {},
			feedback: () => "Your sword is glowing with a faint blue glow.",
			priority: PRIORITY.POST_MUTATION,
		});
	},
});
