import { z } from "zod";
import { registerCoreActions } from "../../src/engine/rules/core-actions";
import {
	ActionRegistry,
	EventBus,
	ensureVisited,
	type GameState,
	getObjectIds,
	getTarget,
	isInInventory,
	isInRoom,
	moveObject,
	movePlayer,
	PRIORITY,
	registerAction,
	registerDaemon,
	setObjectState,
	setPlayerState,
} from "../../src/sdk";

const emptySchema = z.object({});
const objectsSchema = z.object({ objects: z.array(z.string()).optional() });
const _directionSchema = z.object({ direction: z.string().optional() });

export const TREASURE_POINTS: Record<string, { take: number; case: number }> = {
	painting: { take: 4, case: 6 },
	gold_coffin: { take: 10, case: 15 },
	sceptre: { take: 4, case: 6 },
	pot_of_gold: { take: 10, case: 10 },
	crystal_skull: { take: 10, case: 10 },
	huge_diamond: { take: 10, case: 10 },
	jade_figurine: { take: 5, case: 5 },
	trunk_of_jewels: { take: 15, case: 5 },
	crystal_trident: { take: 4, case: 11 },
	large_emerald: { take: 5, case: 10 },
	jeweled_scarab: { take: 5, case: 5 },
	jewel_encrusted_egg: { take: 5, case: 5 },
	golden_clockwork_canary: { take: 6, case: 4 },
	beautiful_brass_bauble: { take: 1, case: 1 },
	bag_of_coins: { take: 10, case: 5 },
	chalice: { take: 10, case: 5 },
	platinum_bar: { take: 10, case: 5 },
	sapphire_bracelet: { take: 5, case: 5 },
	ivory_torch: { take: 14, case: 6 },
	large_bar_of_silver: { take: 10, case: 5 },
};

function calculateScore(state: GameState): number {
	let score = 0;
	// Room discovery points
	if (state.rooms.cellar?.state.visited) score += 25;
	if (state.rooms.treasure_room?.state.visited) score += 25;
	if (state.rooms.kitchen?.state.visited) score += 10;
	if (state.rooms.east_west_passage?.state.visited) score += 5;

	// Machine / diamond discovery
	if (state.objects.huge_diamond?.state.revealed) score += 13;

	// Treasures taken and placed in trophy case
	for (const [id, pts] of Object.entries(TREASURE_POINTS)) {
		const obj = state.objects[id];
		if (!obj) continue;
		if (obj.state.takenOnce) score += pts.take;
		if (obj.location === "trophy_case") score += pts.case;
	}

	return Math.min(score, 350);
}

export function createZorkActionRegistry(): ActionRegistry {
	const bus = new EventBus();
	const registry = new ActionRegistry();
	registerCoreActions(bus, registry);
	setupZorkRules(bus, registry);
	return registry;
}

export function setupZorkRules(bus: EventBus, registry: ActionRegistry): void {
	// ── Score Action ────────────────────────────────────────────────────────────
	registerAction(bus, registry, "score", {
		inputSchema: emptySchema,
		description: "score(): Display current score and rank.",
		aliases: ["points"],
		scope: "always",
		execute: (_params, { state }) => {
			const score = calculateScore(state);
			return `Your score is ${score} of a possible 350 points, in ${state.turn || 0} moves.`;
		},
	});

	// ── Turn On / Light Action ──────────────────────────────────────────────────
	registerAction(bus, registry, "turn_on", {
		inputSchema: objectsSchema,
		description: "turn_on(objects): Turn on or light a light source, e.g. 'turn on lamp'.",
		aliases: ["light", "switch on", "activate"],
		scope: (ctx) =>
			ctx.in_scope_objects.some(
				(o) =>
					["brass_lantern", "pair_of_candles", "matchbook", "ivory_torch"].includes(o.id) ||
					o.id.includes("lamp") ||
					o.id.includes("candle") ||
					o.id.includes("torch"),
			),
		execute: (params, { state }) => {
			const target = getTarget(params as Record<string, unknown>);
			if (target === "brass_lantern" || target === "lamp") {
				setObjectState(state, "brass_lantern", "lit", true);
				return "The brass lantern is now on.";
			}
			if (target === "pair_of_candles" || target === "candles") {
				setObjectState(state, "pair_of_candles", "lit", true);
				return "The candles are now lit.";
			}
			if (target === "matchbook" || target === "match" || target === "matches") {
				return "One of the matches flares to life and burns with a steady flame.";
			}
			return "You can't turn that on.";
		},
	});

	// ── Turn Off / Extinguish Action ────────────────────────────────────────────
	registerAction(bus, registry, "turn_off", {
		inputSchema: objectsSchema,
		description: "turn_off(objects): Turn off or extinguish a light source, e.g. 'turn off lamp'.",
		aliases: ["extinguish", "switch off", "deactivate"],
		scope: (ctx) =>
			ctx.in_scope_objects.some(
				(o) =>
					["brass_lantern", "pair_of_candles", "ivory_torch"].includes(o.id) ||
					o.id.includes("lamp") ||
					o.id.includes("candle") ||
					o.id.includes("torch"),
			),
		execute: (params, { state }) => {
			const target = getTarget(params as Record<string, unknown>);
			if (target === "brass_lantern" || target === "lamp") {
				setObjectState(state, "brass_lantern", "lit", false);
				return "The brass lantern is now off.";
			}
			if (target === "pair_of_candles" || target === "candles") {
				setObjectState(state, "pair_of_candles", "lit", false);
				return "The candles are extinguished.";
			}
			return "You can't turn that off.";
		},
	});

	// ── Tie Action ──────────────────────────────────────────────────────────────
	registerAction(bus, registry, "tie", {
		inputSchema: objectsSchema,
		description: "tie(objects): Tie an object to a target, e.g. 'tie rope to railing'.",
		aliases: ["fasten", "attach"],
		scope: (ctx) => ctx.in_scope_objects.some((o) => o.id === "rope"),
		execute: (params, { state }) => {
			const ids = getObjectIds(params as Record<string, unknown>);
			if (ids.includes("rope") && (ids.includes("railing") || state.player.current_room === "dome_room")) {
				if (!isInInventory(state, "rope") && !isInRoom(state, "rope")) {
					return "You don't have the rope.";
				}
				moveObject(state, "rope", "dome_room");
				setObjectState(state, "rope", "tied", true);
				return "The rope is now securely tied to the railing, and drops into the darkness of the pit below.";
			}
			return "You can't tie that.";
		},
	});

	// ── Pray Action ─────────────────────────────────────────────────────────────
	registerAction(bus, registry, "pray", {
		inputSchema: emptySchema,
		description: "pray(): Offer a prayer at a holy altar.",
		aliases: ["worship"],
		scope: (ctx) => ctx.room.toLowerCase().includes("altar") || ctx.in_scope_objects.some((o) => o.id === "altar"),
		execute: (_params, { state }) => {
			if (state.player.current_room === "altar") {
				movePlayer(state, "forest_1");
				ensureVisited(state, "forest_1");
				return "The room trembles, and everything goes white... When your vision clears, you find yourself outside in the forest.";
			}
			return "Your prayers are not answered here.";
		},
	});

	// ── Wave Action ─────────────────────────────────────────────────────────────
	registerAction(bus, registry, "wave", {
		inputSchema: objectsSchema,
		description: "wave(objects): Wave an item, e.g. 'wave sceptre'.",
		aliases: ["brandish"],
		scope: (ctx) => ctx.in_scope_objects.some((o) => o.id === "sceptre" || o.source === "inventory"),
		execute: (params, { state }) => {
			const target = getTarget(params as Record<string, unknown>);
			if (target === "sceptre") {
				const room = state.player.current_room;
				if (room === "end_of_rainbow" || room === "aragain_falls" || room === "canyon_view") {
					setObjectState(state, "rainbow", "solid", true);
					setObjectState(state, "pot_of_gold", "revealed", true);
					moveObject(state, "pot_of_gold", "end_of_rainbow");
					return "Suddenly, the rainbow seems to become solid and, I venture, walkable! A pot of gold appears at the end of the rainbow.";
				}
				return "You wave the sceptre, but nothing happens.";
			}
			return "Waving that has no effect.";
		},
	});

	// ── Ring Action ─────────────────────────────────────────────────────────────
	registerAction(bus, registry, "ring", {
		inputSchema: objectsSchema,
		description: "ring(objects): Ring a bell, e.g. 'ring bell'.",
		aliases: ["chime", "toll"],
		scope: (ctx) => ctx.in_scope_objects.some((o) => o.id === "brass_bell" || o.name.toLowerCase().includes("bell")),
		execute: (params, { state }) => {
			const target = getTarget(params as Record<string, unknown>);
			if (target === "brass_bell" || target === "bell") {
				if (state.player.current_room === "entrance_to_hades") {
					setObjectState(state, "brass_bell", "hot", true);
					if (isInInventory(state, "brass_bell")) {
						moveObject(state, "brass_bell", "entrance_to_hades");
					}
					return "The bell rings with a piercing, unnatural chime. The spirits cover their ears, wailing in agony! The bell grows searingly hot, and you drop it to the floor.";
				}
				return "Ding, dong. A clear tone resonates.";
			}
			return "You can't ring that.";
		},
	});

	// ── Rub Action ──────────────────────────────────────────────────────────────
	registerAction(bus, registry, "rub", {
		inputSchema: objectsSchema,
		description: "rub(objects): Rub an object, e.g. 'rub mirror'.",
		aliases: ["touch", "polish"],
		scope: (ctx) =>
			ctx.in_scope_objects.some((o) => o.id.includes("mirror") || o.name.toLowerCase().includes("mirror")),
		execute: (params, { state }) => {
			const target = getTarget(params as Record<string, unknown>);
			if (target.includes("mirror")) {
				if (state.player.current_room === "mirror_room_south") {
					movePlayer(state, "mirror_room_north");
					ensureVisited(state, "mirror_room_north");
					return "The mirror wavers like liquid glass, and you feel yourself pulled through space!";
				}
				if (state.player.current_room === "mirror_room_north") {
					movePlayer(state, "mirror_room_south");
					ensureVisited(state, "mirror_room_south");
					return "The mirror wavers like liquid glass, and you feel yourself pulled through space!";
				}
				return "There is no mirror here to rub.";
			}
			return "Rubbing that achieves nothing.";
		},
	});

	// ── Inflate Action ──────────────────────────────────────────────────────────
	registerAction(bus, registry, "inflate", {
		inputSchema: objectsSchema,
		description: "inflate(objects): Inflate an inflatable item using a pump, e.g. 'inflate plastic with pump'.",
		aliases: ["pump", "blow up"],
		scope: (ctx) => ctx.in_scope_objects.some((o) => ["pile_of_plastic", "inflatable_boat"].includes(o.id)),
		execute: (params, { state }) => {
			const ids = getObjectIds(params as Record<string, unknown>);
			if (
				ids.includes("pile_of_plastic") ||
				ids.includes("plastic") ||
				ids.includes("inflatable_boat") ||
				ids.includes("boat")
			) {
				if (!isInInventory(state, "air_pump") && !isInRoom(state, "air_pump")) {
					return "You don't have anything to inflate it with.";
				}
				const room = state.player.current_room;
				setObjectState(state, "pile_of_plastic", "inflated", true);
				moveObject(state, "inflatable_boat", room);
				return "The pile of plastic inflates rapidly, taking the shape of a sturdy inflatable boat.";
			}
			return "You can't inflate that.";
		},
	});

	// ── Launch Action ───────────────────────────────────────────────────────────
	registerAction(bus, registry, "launch", {
		inputSchema: emptySchema,
		description: "launch(): Launch a boat into the water.",
		aliases: ["embark", "set sail"],
		scope: (ctx) => ctx.in_scope_objects.some((o) => o.id === "inflatable_boat"),
		execute: (_params, { state }) => {
			setObjectState(state, "inflatable_boat", "launched", true);
			return "The boat slips smoothly into the river and begins to float with the current.";
		},
	});

	// ── Wait Action ─────────────────────────────────────────────────────────────
	registerAction(bus, registry, "wait", {
		inputSchema: emptySchema,
		description: "wait(): Wait for time to pass.",
		aliases: ["z"],
		scope: "always",
		execute: (_params, { state }) => {
			const room = state.player.current_room;
			if (state.objects.inflatable_boat?.state.launched) {
				if (room === "dam_base" || room === "river_1") {
					movePlayer(state, "river_2");
					ensureVisited(state, "river_2");
					return "The boat glides swiftly through the churning water of the Frigid River.";
				}
				if (room === "river_2") {
					movePlayer(state, "river_3");
					ensureVisited(state, "river_3");
					return "The current carries the boat past sheer white cliffs.";
				}
				if (room === "river_3") {
					movePlayer(state, "river_4");
					ensureVisited(state, "river_4");
					return "The boat drifts into calm water. A large red buoy is bobbing nearby.";
				}
			}
			return "Time passes...";
		},
	});

	// ── Dig Action ──────────────────────────────────────────────────────────────
	registerAction(bus, registry, "dig", {
		inputSchema: objectsSchema,
		description: "dig(objects): Dig with a shovel in soft ground or sand.",
		aliases: ["excavate"],
		scope: (ctx) => ctx.in_scope_objects.some((o) => o.id === "shovel" || o.id === "sand"),
		execute: (_params, { state }) => {
			if (!isInInventory(state, "shovel") && !isInRoom(state, "shovel")) {
				return "You have nothing to dig with.";
			}
			if (state.player.current_room === "sandy_cave") {
				const count = (Number(state.objects.sand?.state.dug) || 0) + 1;
				setObjectState(state, "sand", "dug", count);
				if (count >= 3 && !state.objects.jeweled_scarab?.state.revealed) {
					setObjectState(state, "jeweled_scarab", "revealed", true);
					moveObject(state, "jeweled_scarab", "sandy_cave");
					return "Your shovel strikes something hard! You uncover a beautiful jeweled scarab!";
				}
				return "You dig into the sand, tossing shovelfuls behind you.";
			}
			return "The ground here is too hard for digging.";
		},
	});

	// ── Wind Action ─────────────────────────────────────────────────────────────
	registerAction(bus, registry, "wind", {
		inputSchema: objectsSchema,
		description: "wind(objects): Wind up a mechanical clockwork device, e.g. 'wind up canary'.",
		aliases: ["wind up"],
		scope: (ctx) =>
			ctx.in_scope_objects.some((o) => o.id === "golden_clockwork_canary" || o.name.toLowerCase().includes("canary")),
		execute: (params, { state }) => {
			const target = getTarget(params as Record<string, unknown>);
			if (target === "golden_clockwork_canary" || target === "canary") {
				const room = state.player.current_room;
				if (room === "up_a_tree" || room.startsWith("forest")) {
					setObjectState(state, "beautiful_brass_bauble", "revealed", true);
					moveObject(state, "beautiful_brass_bauble", room);
					return "The canary sings a beautiful, crystal-clear birdsong that echoes through the canopy. High above, an answering call is heard. A large songbird swoops down from the treetops, drops something sparkling at your feet, and flutters away.";
				}
				return "The canary sings a brief melody, but nothing happens.";
			}
			return "You can't wind that up.";
		},
	});

	// ── Ulysses / Odysseus Action ───────────────────────────────────────────────
	registerAction(bus, registry, "ulysses", {
		inputSchema: emptySchema,
		description: "ulysses(): Say the name Ulysses or Odysseus.",
		aliases: ["odysseus"],
		scope: (ctx) => ctx.in_scope_objects.some((o) => o.id === "cyclops") || ctx.room.toLowerCase().includes("cyclops"),
		execute: (_params, { state }) => {
			if (state.player.current_room === "cyclops_room" && !state.objects.cyclops?.state.fled) {
				setObjectState(state, "cyclops", "fled", true);
				return "The cyclops is visibly shaken, and stumbles backward through the broken wall into the dark!";
			}
			return "Nothing happens.";
		},
	});

	// ── Echo Action ─────────────────────────────────────────────────────────────
	registerAction(bus, registry, "echo", {
		inputSchema: emptySchema,
		description: "echo(): Shout an echo in an acoustic chamber.",
		aliases: [],
		scope: (ctx) => ctx.room.toLowerCase().includes("loud") || ctx.room.toLowerCase().includes("echo"),
		execute: (_params, { state }) => {
			if (state.player.current_room === "loud_room") {
				setObjectState(state, "loud_room_acoustics", "echoed", true);
				return "The acoustics of the room change subtly.";
			}
			return "Echo... echo... echo...";
		},
	});

	// ── Basket Winch Actions ────────────────────────────────────────────────────
	registerAction(bus, registry, "lower", {
		inputSchema: objectsSchema,
		description: "lower(objects): Lower an object with a winch or rope, e.g. 'lower basket'.",
		aliases: [],
		scope: (ctx) => ctx.in_scope_objects.some((o) => o.id === "basket"),
		execute: (params, { state }) => {
			const target = getTarget(params as Record<string, unknown>);
			if (target === "basket") {
				setObjectState(state, "basket", "lowered", true);
				moveObject(state, "basket", "drafty_room");
				return "The basket is lowered into the shaft, disappearing into the depths below.";
			}
			return "You can't lower that.";
		},
	});

	registerAction(bus, registry, "raise", {
		inputSchema: objectsSchema,
		description: "raise(objects): Raise an object with a winch, e.g. 'raise basket'.",
		aliases: ["pull up", "hoist"],
		scope: (ctx) => ctx.in_scope_objects.some((o) => o.id === "basket"),
		execute: (params, { state }) => {
			const target = getTarget(params as Record<string, unknown>);
			if (target === "basket") {
				setObjectState(state, "basket", "lowered", false);
				moveObject(state, "basket", "shaft_room");
				return "The basket is raised up the shaft, returning to the shaft room.";
			}
			return "You can't raise that.";
		},
	});

	// ── Move Rug Rule ───────────────────────────────────────────────────────────
	bus.on("move", "oriental_rug", (event, state) => {
		event.stop();
		setObjectState(state, "oriental_rug", "moved", true);
		return "With a great effort, the rug is moved to one side of the room, revealing the dusty cover of a closed trap door.";
	});

	// ── Open Trap Door Rule ─────────────────────────────────────────────────────
	bus.on(
		"open",
		"trap_door",
		(event, state) => {
			if (state.player.current_room === "living_room" && !state.objects.oriental_rug?.state.moved) {
				event.stop();
				return "The rug covers the trap door.";
			}
			setObjectState(state, "trap_door", "open", true);
			event.stop();
			return "The door reluctantly opens to reveal a rickety staircase descending into darkness.";
		},
		{ priority: PRIORITY.GUARD },
	);

	// ── Open Kitchen Window Rule ────────────────────────────────────────────────
	bus.on(
		"open",
		"kitchen_window",
		(event, state) => {
			setObjectState(state, "kitchen_window", "open", true);
			event.stop();
			return "With great effort, you open the window far enough to allow entry.";
		},
		{ priority: PRIORITY.GUARD },
	);

	// ── Open Front Door Rule ────────────────────────────────────────────────────
	bus.on(
		"open",
		"front_door",
		(event) => {
			event.stop();
			return "The door cannot be opened.";
		},
		{ priority: PRIORITY.GUARD },
	);

	// ── Enter Cellar Closes Trapdoor ───────────────────────────────────────────
	bus.on(
		"go",
		(event, state) => {
			const dir = (event.params as Record<string, unknown>).direction;
			if (state.player.current_room === "cellar" && dir === "down") {
				setObjectState(state, "trap_door", "open", false);
				return "The trap door crashes shut, and you hear someone barring it.";
			}
		},
		{ priority: PRIORITY.POST_MUTATION },
	);

	// ── Machine Lid Controls Machine ───────────────────────────────────────────
	bus.on("open", "machine_lid", (event, state) => {
		setObjectState(state, "smelly_machine", "open", true);
		setObjectState(state, "machine_lid", "open", true);
		event.stop();
		return "The lid of the machine opens.";
	});
	bus.on("close", "machine_lid", (event, state) => {
		setObjectState(state, "smelly_machine", "open", false);
		setObjectState(state, "machine_lid", "open", false);
		event.stop();
		return "The lid of the machine closes.";
	});

	// ── Troll Combat ────────────────────────────────────────────────────────────
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

	bus.on("attack", "troll", (event, state) => {
		const troll = state.objects.troll;
		if (troll?.state.dead) {
			event.stop();
			return "The troll is already dead.";
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

	// ── Thief Combat ────────────────────────────────────────────────────────────
	bus.on("attack", "thief", (event, state) => {
		const thief = state.objects.thief;
		if (thief?.state.dead) {
			event.stop();
			return "The thief is already dead.";
		}
		const hp = (Number(thief?.state.hp) || 3) - 1;
		setObjectState(state, "thief", "hp", hp);

		if (hp <= 0) {
			setObjectState(state, "thief", "dead", true);
			setObjectState(state, "thief", "alive", false);
			event.stop();
			return "The thief collapses to the floor, dead. His stolen treasures scatter across the room.";
		}

		event.stop();
		return "You strike at the thief, landing a telling blow!";
	});

	// ── Give Egg to Thief ───────────────────────────────────────────────────────
	bus.on("put", (event, state) => {
		const ids = getObjectIds(event.params as Record<string, unknown>);
		if (ids[0] === "jewel_encrusted_egg" && (ids[1] === "thief" || state.player.current_room === "treasure_room")) {
			setObjectState(state, "jewel_encrusted_egg", "open", true);
			moveObject(state, "golden_clockwork_canary", "jewel_encrusted_egg");
			event.stop();
			return "The thief skillfully pries open the egg with his delicate tools, revealing a golden clockwork canary inside!";
		}
	});

	// ── Read Actions ────────────────────────────────────────────────────────────
	bus.on("examine", "black_book", (_event, state) => {
		if (state.player.current_room === "entrance_to_hades" && state.objects.pair_of_candles?.state.lit) {
			setObjectState(state, "spirits", "exorcised", true);
			return "As you read the holy rites from the black book, the cavern shakes! The spirits shriek in terror and scatter into the shadows. The gates of Hades swing slowly open!";
		}
	});

	// ── Push Yellow Button ──────────────────────────────────────────────────────
	bus.on("move", "yellow_button", (event, state) => {
		setObjectState(state, "control_panel", "powered", true);
		event.stop();
		return "Click. The lights on the control panel blink to life.";
	});

	// ── Turn Bolt with Wrench & Switch with Screwdriver ─────────────────────────
	bus.on(
		"use",
		(event, state) => {
			const ids = getObjectIds(event.params as Record<string, unknown>);
			if (ids.includes("wrench") || ids.includes("large_bolt")) {
				if (state.player.current_room === "dam") {
					setObjectState(state, "reservoir", "drained", true);
					setObjectState(state, "sluice_gates", "open", true);
					event.stop();
					return "The bolt turns with a screech of rusty metal. The sluice gates groan open! Water roars out of the reservoir in a tremendous torrent. The reservoir is quickly drained!";
				}
			}
			if (ids.includes("screwdriver") || ids.includes("machine_switch")) {
				if (state.player.current_room === "machine_room") {
					if (state.objects.coal?.location === "smelly_machine") {
						moveObject(state, "coal", "machine_room");
						setObjectState(state, "coal", "burned", true);
						moveObject(state, "huge_diamond", "smelly_machine");
						setObjectState(state, "huge_diamond", "revealed", true);
						event.stop();
						return "The machine trembles violently, grinding and shrieking! Smoke billows from the exhaust vents. With a loud CLANK, the machine falls silent.";
					}
				}
			}
		},
		{ priority: PRIORITY.GUARD },
	);

	// ── Put in Trophy Case Scoring ──────────────────────────────────────────────
	bus.on("put", (event, state) => {
		const ids = getObjectIds(event.params as Record<string, unknown>);
		if (ids[1] === "trophy_case") {
			const item = ids[0];
			if (TREASURE_POINTS[item]) {
				const score = calculateScore(state);
				return [`Done.`, `Points: ${score}`];
			}
		}
	});

	// ── Take Tracking for Points ────────────────────────────────────────────────
	bus.on("take", (event, state) => {
		const ids = getObjectIds(event.params as Record<string, unknown>);
		for (const id of ids) {
			if (TREASURE_POINTS[id]) {
				setObjectState(state, id, "takenOnce", true);
			}
		}
	});

	// ── Troll Room Surprise Attack & Glow ──────────────────────────────────────
	bus.on(
		"look",
		(_event, state) => {
			const room = state.player.current_room;
			const troll = state.objects.troll;
			if (room === "troll_room" && !troll?.state.dead && !state.player.state.troll_encountered) {
				setPlayerState(state, "troll_encountered", true);
				setPlayerState(state, "staggered", true);
				const feedback: string[] = [];
				if (isInInventory(state, "elvish_sword")) {
					feedback.push("Your sword has begun to glow very brightly.");
				}
				feedback.push("The troll's mighty blow drops you to your knees.");
				return feedback;
			}
		},
		{ priority: PRIORITY.POST_MUTATION },
	);

	// ── Sword Glow Daemon ───────────────────────────────────────────────────────
	registerDaemon(bus, "sword-glow", {
		condition: (_world, state) => {
			return isInInventory(state, "elvish_sword") && !state.objects.troll?.state.dead;
		},
		effect: () => {},
		feedback: (_world, state) => {
			const room = state.player.current_room;
			if (room === "cellar" || room === "east_west_passage") {
				return "Your sword is glowing with a faint blue glow.";
			}
			return "";
		},
		priority: PRIORITY.POST_MUTATION,
	});
}
