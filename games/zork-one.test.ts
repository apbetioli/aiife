import { describe, expect, it } from "vitest";
import { buildInitialState } from "../src/engine/initial-state";
import { isInInventory } from "../src/engine/mutators";
import { buildParserContext } from "../src/engine/parser-context";
import { ActionRegistry, EventBus } from "../src/engine/rules";
import { registerCoreActions } from "../src/engine/rules/core-actions";
import { executeAction } from "../src/engine/rules/executor";
import { WorldSchema } from "../src/world/types";
import zorkOne from "./zork-one";

const { world, setup: zorkSetup } = zorkOne;

describe("Zork One world definition and rules", () => {
	function setup() {
		const bus = new EventBus();
		const registry = new ActionRegistry();
		registerCoreActions(bus, registry);
		zorkSetup?.(bus, registry);
		const state = buildInitialState(world);
		return { bus, state };
	}

	it("validates and builds initial state for zork-one (TS) with 110 rooms without errors", () => {
		expect(() => WorldSchema.parse(world)).not.toThrow();
		const state = buildInitialState(world);
		expect(state.player.current_room).toBe("west_of_house");
		expect(Object.keys(world.rooms).length).toBe(110);
		expect(Object.keys(world.objects).length).toBeGreaterThanOrEqual(80);
		expect(state.objects.front_door).toBeDefined();
		expect(state.objects.small_mailbox).toBeDefined();
		expect(state.objects.leaflet).toBeDefined();
		expect(state.objects.elvish_sword).toBeDefined();
		expect(state.objects.brass_lantern).toBeDefined();
		expect(state.objects.troll).toBeDefined();
	});

	it("look only describes mailbox and room, hiding scenery front door", () => {
		const { bus, state } = setup();
		const result = executeAction(bus, world, state, "look", {});

		expect(result.stopped).toBe(false);
		const text = result.feedback.join("\n");
		expect(text).toContain("West of House");
		expect(text).toContain("You are standing in an open field west of a white house, with a boarded front door.");
		expect(text).toContain("There is a small mailbox here.");
		expect(text).not.toContain("The front door of the white house. It is firmly boarded shut");
		expect(text).not.toContain("welcome mat");
	});

	it("examine front door and boards returns the door description", () => {
		const { bus, state } = setup();
		const resultDoor = executeAction(bus, world, state, "examine", { objects: ["front_door"] });
		expect(resultDoor.stopped).toBe(false);
		expect(resultDoor.feedback.join(" ")).toContain("It is firmly boarded shut and cannot be opened.");
	});

	it("open front door returns cannot open message via setup rule", () => {
		const { bus, state } = setup();
		const result = executeAction(bus, world, state, "open", { objects: ["front_door"] });
		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("The door cannot be opened.");
	});

	it("go east is blocked by the boarded door", () => {
		const { bus, state } = setup();
		const result = executeAction(bus, world, state, "go", { direction: "east" });
		expect(result.stopped).toBe(true);
		expect(result.feedback).toContain("The door is boarded and you can't remove the boards.");
	});

	it("opening the mailbox reveals the leaflet and brings it into scope", () => {
		const { bus, state } = setup();

		// Initially mailbox is closed, leaflet is not in scope
		const ctxClosed = buildParserContext(world, state);
		const closedIds = ctxClosed.in_scope_objects.map((o) => o.id);
		expect(closedIds).toContain("small_mailbox");
		expect(closedIds).toContain("front_door");
		expect(closedIds).not.toContain("leaflet");

		// Open mailbox
		const openResult = executeAction(bus, world, state, "open", { objects: ["small_mailbox"] });
		expect(openResult.stopped).toBe(false);
		expect(openResult.feedback.join("\n")).toContain("Opening the small mailbox reveals:\n  leaflet");

		// Now leaflet is in scope
		const ctxOpen = buildParserContext(world, openResult.state);
		const openIds = ctxOpen.in_scope_objects.map((o) => o.id);
		expect(openIds).toContain("leaflet");

		// Can take the leaflet
		const takeResult = executeAction(bus, world, openResult.state, "take", { objects: ["leaflet"] });
		expect(takeResult.stopped).toBe(false);
		expect(isInInventory(takeResult.state, "leaflet")).toBe(true);

		// Can examine / read the leaflet
		const readResult = executeAction(bus, world, takeResult.state, "examine", { objects: ["leaflet"] });
		expect(readResult.stopped).toBe(false);
		expect(readResult.feedback.join(" ")).toContain("WELCOME TO ZORK!");
		expect(readResult.feedback.join(" ")).toContain("adventure, danger, and low cunning");
	});

	it("can examine/read the leaflet directly inside the open mailbox without taking it first", () => {
		const { bus, state } = setup();
		const openResult = executeAction(bus, world, state, "open", { objects: ["small_mailbox"] });
		expect(openResult.stopped).toBe(false);

		const readResult = executeAction(bus, world, openResult.state, "examine", { objects: ["leaflet"] });
		expect(readResult.stopped).toBe(false);
		expect(readResult.feedback.join(" ")).toContain("WELCOME TO ZORK!");
	});

	it("navigates around the house, opens the window, enters kitchen and living room", () => {
		const { bus, state: s0 } = setup();

		// Go south -> east to Behind House
		const s1 = executeAction(bus, world, s0, "go", { direction: "south" }).state;
		expect(s1.player.current_room).toBe("south_of_house");

		const s2 = executeAction(bus, world, s1, "go", { direction: "east" }).state;
		expect(s2.player.current_room).toBe("behind_house");

		// Try going in before window open
		const blocked = executeAction(bus, world, s2, "go", { direction: "west" });
		expect(blocked.stopped).toBe(true);

		// Open window
		const winRes = executeAction(bus, world, s2, "open", { objects: ["kitchen_window"] });
		expect(winRes.stopped).toBe(true);
		expect(winRes.feedback.join(" ")).toContain("With great effort, you open the window");

		// Now enter kitchen
		const s3 = executeAction(bus, world, winRes.state, "go", { direction: "west" }).state;
		expect(s3.player.current_room).toBe("kitchen");

		// Go west to Living Room
		const s4 = executeAction(bus, world, s3, "go", { direction: "west" }).state;
		expect(s4.player.current_room).toBe("living_room");
	});

	it("moves rug, opens trapdoor, descends into cellar", () => {
		const { bus, state: s0 } = setup();
		let s = s0;
		s = executeAction(bus, world, s, "go", { direction: "south" }).state;
		s = executeAction(bus, world, s, "go", { direction: "east" }).state;
		s = executeAction(bus, world, s, "open", { objects: ["kitchen_window"] }).state;
		s = executeAction(bus, world, s, "go", { direction: "west" }).state;
		s = executeAction(bus, world, s, "go", { direction: "west" }).state;
		expect(s.player.current_room).toBe("living_room");

		// Trapdoor cannot open before rug moved
		const openTrapFail = executeAction(bus, world, s, "open", { objects: ["trap_door"] });
		expect(openTrapFail.stopped).toBe(true);
		expect(openTrapFail.feedback.join(" ")).toContain("rug covers the trap door");

		// Move rug
		const moveRug = executeAction(bus, world, s, "move", { objects: ["oriental_rug"] });
		expect(moveRug.feedback.join(" ")).toContain("rug is moved to one side");
		s = moveRug.state;

		// Now open trapdoor
		const openTrap = executeAction(bus, world, s, "open", { objects: ["trap_door"] });
		expect(openTrap.feedback.join(" ")).toContain("rickety staircase descending into darkness");
		s = openTrap.state;

		// Turn on lamp
		const takeLamp = executeAction(bus, world, s, "take", { objects: ["brass_lantern"] });
		s = takeLamp.state;
		const lampOn = executeAction(bus, world, s, "turn_on", { objects: ["brass_lantern"] });
		expect(lampOn.feedback.join(" ")).toContain("brass lantern is now on");
		s = lampOn.state;

		// Descend into cellar
		const downRes = executeAction(bus, world, s, "go", { direction: "down" });
		expect(downRes.stopped).toBe(false);
		expect(downRes.state.player.current_room).toBe("cellar");
		expect(downRes.feedback.join(" ")).toContain("trap door crashes shut");
		expect(downRes.state.objects.trap_door?.state.open).toBe(false);
	});

	it("combats troll with elvish sword and unblocks passages", () => {
		const { bus, state: s0 } = setup();
		let s = s0;
		// Give player sword and put in troll room
		s = executeAction(bus, world, s, "go", { direction: "south" }).state;
		s = executeAction(bus, world, s, "go", { direction: "east" }).state;
		s = executeAction(bus, world, s, "open", { objects: ["kitchen_window"] }).state;
		s = executeAction(bus, world, s, "go", { direction: "west" }).state;
		s = executeAction(bus, world, s, "go", { direction: "west" }).state;
		s = executeAction(bus, world, s, "take", { objects: ["elvish_sword"] }).state;
		s = executeAction(bus, world, s, "move", { objects: ["oriental_rug"] }).state;
		s = executeAction(bus, world, s, "open", { objects: ["trap_door"] }).state;
		s = executeAction(bus, world, s, "go", { direction: "down" }).state; // cellar
		s = executeAction(bus, world, s, "go", { direction: "north" }).state; // troll_room
		expect(s.player.current_room).toBe("troll_room");

		// Try going east before defeating troll
		const blocked = executeAction(bus, world, s, "go", { direction: "east" });
		expect(blocked.stopped).toBe(true);
		expect(blocked.feedback.join(" ")).toContain("The troll blocks your way");

		// Attack troll with sword
		const a1 = executeAction(bus, world, s, "attack", { objects: ["troll", "elvish_sword"] });
		expect(a1.feedback.join(" ")).toContain("troll parries");
		s = a1.state;

		const a2 = executeAction(bus, world, s, "attack", { objects: ["troll", "elvish_sword"] });
		expect(a2.feedback.join(" ")).toContain("confused and can't fight back");
		s = a2.state;

		const a3 = executeAction(bus, world, s, "attack", { objects: ["troll", "elvish_sword"] });
		expect(a3.feedback.join(" ")).toContain("sinister black fog");
		expect(a3.state.objects.troll?.state.dead).toBe(true);
		s = a3.state;

		// Now east is open to East-West passage
		const goEast = executeAction(bus, world, s, "go", { direction: "east" });
		expect(goEast.stopped).toBe(false);
		expect(goEast.state.player.current_room).toBe("east_west_passage");
	});

	it("ties rope to railing in dome room and descends to torch room", () => {
		const { bus, state: s0 } = setup();
		let s = s0;
		// Place player in dome_room with rope
		s = {
			...s,
			player: { ...s.player, current_room: "dome_room" },
			objects: {
				...s.objects,
				rope: { ...s.objects.rope, location: "inventory" },
			},
		};

		// Try going down before rope is tied
		const blocked = executeAction(bus, world, s, "go", { direction: "down" });
		expect(blocked.stopped).toBe(true);
		expect(blocked.feedback.join(" ")).toContain("jump down without a rope");

		// Tie rope to railing
		const tieRes = executeAction(bus, world, s, "tie", { objects: ["rope", "railing"] });
		expect(tieRes.feedback.join(" ")).toContain("securely tied to the railing");
		expect(tieRes.state.objects.rope?.state.tied).toBe(true);
		s = tieRes.state;

		// Now descend down to torch_room
		const downRes = executeAction(bus, world, s, "go", { direction: "down" });
		expect(downRes.stopped).toBe(false);
		expect(downRes.state.player.current_room).toBe("torch_room");

		// Take ivory torch
		const takeTorch = executeAction(bus, world, downRes.state, "take", { objects: ["ivory_torch"] });
		expect(takeTorch.stopped).toBe(false);
		expect(isInInventory(takeTorch.state, "ivory_torch")).toBe(true);
	});

	it("prays at altar to teleport to forest and waves sceptre to reveal pot of gold", () => {
		const { bus, state: s0 } = setup();
		let s = s0;
		// Place player at altar with sceptre
		s = {
			...s,
			player: { ...s.player, current_room: "altar" },
			objects: {
				...s.objects,
				sceptre: { ...s.objects.sceptre, location: "inventory" },
			},
		};

		// Pray at altar
		const prayRes = executeAction(bus, world, s, "pray", {});
		expect(prayRes.feedback.join(" ")).toContain("you find yourself outside in the forest");
		expect(prayRes.state.player.current_room).toBe("forest_1");
		s = prayRes.state;

		// Move player to End of Rainbow
		s = { ...s, player: { ...s.player, current_room: "end_of_rainbow" } };

		// Wave sceptre at End of Rainbow
		const waveRes = executeAction(bus, world, s, "wave", { objects: ["sceptre"] });
		expect(waveRes.feedback.join(" ")).toContain("Suddenly, the rainbow seems to become solid");
		expect(waveRes.feedback.join(" ")).toContain("pot of gold appears at the end of the rainbow");
		expect(waveRes.state.objects.rainbow?.state.solid).toBe(true);
		expect(waveRes.state.objects.pot_of_gold?.state.revealed).toBe(true);
		expect(waveRes.state.objects.pot_of_gold?.location).toBe("end_of_rainbow");

		// Take pot of gold
		const takeGold = executeAction(bus, world, waveRes.state, "take", { objects: ["pot_of_gold"] });
		expect(takeGold.stopped).toBe(false);
		expect(isInInventory(takeGold.state, "pot_of_gold")).toBe(true);
	});

	it("drains reservoir with wrench at Dam #3 and reveals trunk of jewels", () => {
		const { bus, state: s0 } = setup();
		let s = s0;
		s = {
			...s,
			player: { ...s.player, current_room: "reservoir_south" },
			objects: {
				...s.objects,
				wrench: { ...s.objects.wrench, location: "inventory" },
			},
		};

		// Try going north into reservoir before draining
		const blocked = executeAction(bus, world, s, "go", { direction: "north" });
		expect(blocked.stopped).toBe(true);
		expect(blocked.feedback.join(" ")).toContain("You would drown");

		// Move player to dam to turn bolt
		s = { ...s, player: { ...s.player, current_room: "dam" } };
		const turnRes = executeAction(bus, world, s, "use", { objects: ["wrench", "large_bolt"] });
		expect(turnRes.feedback.join(" ")).toContain("sluice gates groan open! Water roars out of the reservoir");
		expect(turnRes.state.objects.reservoir?.state.drained).toBe(true);
		s = turnRes.state;

		// Move to reservoir_south and walk north into reservoir
		s = { ...s, player: { ...s.player, current_room: "reservoir_south" } };
		const goRes = executeAction(bus, world, s, "go", { direction: "north" });
		expect(goRes.stopped).toBe(false);
		expect(goRes.state.player.current_room).toBe("reservoir");

		// Take trunk of jewels from muddy bed
		const takeTrunk = executeAction(bus, world, goRes.state, "take", { objects: ["trunk_of_jewels"] });
		expect(takeTrunk.stopped).toBe(false);
		expect(isInInventory(takeTrunk.state, "trunk_of_jewels")).toBe(true);
	});

	it("exorcises evil spirits at Entrance to Hades with bell, candles, and book", () => {
		const { bus, state: s0 } = setup();
		let s = s0;
		s = {
			...s,
			player: { ...s.player, current_room: "entrance_to_hades" },
			objects: {
				...s.objects,
				brass_bell: { ...s.objects.brass_bell, location: "inventory" },
				pair_of_candles: { ...s.objects.pair_of_candles, location: "inventory", state: { lit: true } },
				black_book: { ...s.objects.black_book, location: "inventory" },
			},
		};

		// Try entering before exorcism
		const blocked = executeAction(bus, world, s, "go", { direction: "south" });
		expect(blocked.stopped).toBe(true);
		expect(blocked.feedback.join(" ")).toContain("malevolent spirits blocks your passage");

		// Ring bell
		const ringRes = executeAction(bus, world, s, "ring", { objects: ["brass_bell"] });
		expect(ringRes.feedback.join(" ")).toContain("spirits cover their ears");
		expect(ringRes.feedback.join(" ")).toContain("bell grows searingly hot");
		s = ringRes.state;

		// Read black book with lit candles
		const readRes = executeAction(bus, world, s, "examine", { objects: ["black_book"] });
		expect(readRes.feedback.join(" ")).toContain("holy rites from the black book");
		expect(readRes.feedback.join(" ")).toContain("gates of Hades swing slowly open");
		expect(readRes.state.objects.spirits?.state.exorcised).toBe(true);
		s = readRes.state;

		// Now go south into Land of the Dead
		const enterDead = executeAction(bus, world, s, "go", { direction: "south" });
		expect(enterDead.stopped).toBe(false);
		expect(enterDead.state.player.current_room).toBe("land_of_the_dead");

		// Take crystal skull
		const takeSkull = executeAction(bus, world, enterDead.state, "take", { objects: ["crystal_skull"] });
		expect(takeSkull.stopped).toBe(false);
		expect(isInInventory(takeSkull.state, "crystal_skull")).toBe(true);
	});

	it("operates coal mine machine to turn coal into huge diamond", () => {
		const { bus, state: s0 } = setup();
		let s = s0;
		s = {
			...s,
			player: { ...s.player, current_room: "machine_room" },
			objects: {
				...s.objects,
				coal: { ...s.objects.coal, location: "machine_room" },
				screwdriver: { ...s.objects.screwdriver, location: "inventory" },
			},
		};

		// Open machine lid, put coal in machine, close lid
		s = executeAction(bus, world, s, "open", { objects: ["machine_lid"] }).state;
		s = executeAction(bus, world, s, "put", { objects: ["coal", "smelly_machine"] }).state;
		s = executeAction(bus, world, s, "close", { objects: ["machine_lid"] }).state;

		// Turn switch with screwdriver
		const turnRes = executeAction(bus, world, s, "use", { objects: ["screwdriver", "machine_switch"] });
		expect(turnRes.feedback.join(" ")).toContain("machine falls silent");
		expect(turnRes.state.objects.huge_diamond?.state.revealed).toBe(true);
		s = turnRes.state;

		// Open lid and take diamond from machine
		s = executeAction(bus, world, s, "open", { objects: ["machine_lid"] }).state;
		const takeDiamond = executeAction(bus, world, s, "take", { objects: ["huge_diamond"] });
		expect(takeDiamond.stopped).toBe(false);
		expect(isInInventory(takeDiamond.state, "huge_diamond")).toBe(true);
	});

	it("inflates boat, drifts to buoy for emerald, and digs sand with shovel for scarab", () => {
		const { bus, state: s0 } = setup();
		let s = s0;
		s = {
			...s,
			player: { ...s.player, current_room: "dam_base" },
			objects: {
				...s.objects,
				air_pump: { ...s.objects.air_pump, location: "inventory" },
			},
		};

		// Inflate plastic with pump
		const infRes = executeAction(bus, world, s, "inflate", { objects: ["pile_of_plastic", "air_pump"] });
		expect(infRes.feedback.join(" ")).toContain("sturdy inflatable boat");
		s = infRes.state;

		// Launch boat and drift with wait
		s = executeAction(bus, world, s, "launch", {}).state;
		s = executeAction(bus, world, s, "wait", {}).state; // river_2
		s = executeAction(bus, world, s, "wait", {}).state; // river_3
		s = executeAction(bus, world, s, "wait", {}).state; // river_4
		expect(s.player.current_room).toBe("river_4");

		// Take buoy and open it
		s = executeAction(bus, world, s, "take", { objects: ["red_buoy"] }).state;
		const openBuoy = executeAction(bus, world, s, "open", { objects: ["red_buoy"] });
		expect(openBuoy.feedback.join(" ")).toContain("large emerald");
		const takeEmerald = executeAction(bus, world, openBuoy.state, "take", { objects: ["large_emerald"] });
		expect(isInInventory(takeEmerald.state, "large_emerald")).toBe(true);

		// Dig in sandy cave with shovel
		let sCave = {
			...takeEmerald.state,
			player: { ...takeEmerald.state.player, current_room: "sandy_cave" },
			objects: {
				...takeEmerald.state.objects,
				shovel: { ...takeEmerald.state.objects.shovel, location: "inventory" },
			},
		};

		sCave = executeAction(bus, world, sCave, "dig", { objects: ["sand"] }).state;
		sCave = executeAction(bus, world, sCave, "dig", { objects: ["sand"] }).state;
		const dig3 = executeAction(bus, world, sCave, "dig", { objects: ["sand"] });
		expect(dig3.feedback.join(" ")).toContain("uncover a beautiful jeweled scarab");
		const takeScarab = executeAction(bus, world, dig3.state, "take", { objects: ["jeweled_scarab"] });
		expect(isInInventory(takeScarab.state, "jeweled_scarab")).toBe(true);
	});

	it("frightens cyclops with Ulysses and quiets loud room with echo", () => {
		const { bus, state: s0 } = setup();

		// Cyclops room
		const sCyc = { ...s0, player: { ...s0.player, current_room: "cyclops_room" } };
		const ulyssesRes = executeAction(bus, world, sCyc, "ulysses", {});
		expect(ulyssesRes.feedback.join(" ")).toContain("cyclops is visibly shaken, and stumbles backward");
		expect(ulyssesRes.state.objects.cyclops?.state.fled).toBe(true);

		// Loud room
		const sLoud = { ...s0, player: { ...s0.player, current_room: "loud_room" } };
		const echoRes = executeAction(bus, world, sLoud, "echo", {});
		expect(echoRes.feedback.join(" ")).toContain("acoustics of the room change subtly");
		expect(echoRes.state.objects.loud_room_acoustics?.state.echoed).toBe(true);
		const takeBar = executeAction(bus, world, echoRes.state, "take", { objects: ["platinum_bar"] });
		expect(takeBar.stopped).toBe(false);
		expect(isInInventory(takeBar.state, "platinum_bar")).toBe(true);
	});

	it("deposits all 19 treasures into trophy case to accumulate maximum score", () => {
		const { bus, state: s0 } = setup();

		const treasureIds = [
			"painting",
			"gold_coffin",
			"sceptre",
			"pot_of_gold",
			"crystal_skull",
			"huge_diamond",
			"jade_figurine",
			"trunk_of_jewels",
			"crystal_trident",
			"large_emerald",
			"jeweled_scarab",
			"jewel_encrusted_egg",
			"golden_clockwork_canary",
			"beautiful_brass_bauble",
			"bag_of_coins",
			"chalice",
			"platinum_bar",
			"sapphire_bracelet",
			"ivory_torch",
		];

		let s = {
			...s0,
			player: { ...s0.player, current_room: "living_room" },
			rooms: {
				...s0.rooms,
				cellar: { ...s0.rooms.cellar, state: { ...s0.rooms.cellar.state, visited: true } },
				treasure_room: { ...s0.rooms.treasure_room, state: { ...s0.rooms.treasure_room.state, visited: true } },
				kitchen: { ...s0.rooms.kitchen, state: { ...s0.rooms.kitchen.state, visited: true } },
				east_west_passage: {
					...s0.rooms.east_west_passage,
					state: { ...s0.rooms.east_west_passage.state, visited: true },
				},
			},
			objects: {
				...s0.objects,
				huge_diamond: { ...s0.objects.huge_diamond, state: { ...s0.objects.huge_diamond.state, revealed: true } },
			},
		};

		// Take and deposit each treasure
		for (const id of treasureIds) {
			s = {
				...s,
				objects: {
					...s.objects,
					[id]: {
						...s.objects[id],
						location: "inventory",
						state: { ...s.objects[id].state, takenOnce: true },
					},
				},
			};
			const res = executeAction(bus, world, s, "put", { objects: [id, "trophy_case"] });
			s = res.state;
		}

		// Check score
		const scoreRes = executeAction(bus, world, s, "score", {});
		expect(scoreRes.feedback.join(" ")).toContain("350 points");
	});

	it("executes an end-to-end multi-room walkthrough sequence", () => {
		const { bus, state: s0 } = setup();
		let s = s0;

		// 1. West of house: open mailbox, take leaflet, read it, drop it
		s = executeAction(bus, world, s, "open", { objects: ["small_mailbox"] }).state;
		s = executeAction(bus, world, s, "take", { objects: ["leaflet"] }).state;
		const readRes = executeAction(bus, world, s, "examine", { objects: ["leaflet"] });
		expect(readRes.feedback.join(" ")).toContain("WELCOME TO ZORK!");
		s = executeAction(bus, world, readRes.state, "drop", { objects: ["leaflet"] }).state;

		// 2. Navigate around the house to Behind House
		s = executeAction(bus, world, s, "go", { direction: "south" }).state;
		expect(s.player.current_room).toBe("south_of_house");
		s = executeAction(bus, world, s, "go", { direction: "east" }).state;
		expect(s.player.current_room).toBe("behind_house");

		// 3. Open window and enter Kitchen
		s = executeAction(bus, world, s, "open", { objects: ["kitchen_window"] }).state;
		s = executeAction(bus, world, s, "go", { direction: "west" }).state;
		expect(s.player.current_room).toBe("kitchen");

		// 4. Enter Living Room and take lantern and sword
		s = executeAction(bus, world, s, "go", { direction: "west" }).state;
		expect(s.player.current_room).toBe("living_room");
		s = executeAction(bus, world, s, "take", { objects: ["brass_lantern"] }).state;
		s = executeAction(bus, world, s, "take", { objects: ["elvish_sword"] }).state;

		// 5. Move rug, open trapdoor, turn on lantern
		s = executeAction(bus, world, s, "move", { objects: ["oriental_rug"] }).state;
		s = executeAction(bus, world, s, "open", { objects: ["trap_door"] }).state;
		s = executeAction(bus, world, s, "turn_on", { objects: ["brass_lantern"] }).state;

		// 6. Descend into Cellar (trap door shuts behind player)
		const downRes = executeAction(bus, world, s, "go", { direction: "down" });
		expect(downRes.feedback.join(" ")).toContain("trap door crashes shut");
		s = downRes.state;
		expect(s.player.current_room).toBe("cellar");
		expect(s.objects.trap_door?.state.open).toBe(false);

		// 7. Go south to East of Chasm, then east to Gallery
		s = executeAction(bus, world, s, "go", { direction: "south" }).state;
		expect(s.player.current_room).toBe("east_of_chasm");
		s = executeAction(bus, world, s, "go", { direction: "east" }).state;
		expect(s.player.current_room).toBe("gallery");

		// 8. Take painting
		const takePainting = executeAction(bus, world, s, "take", { objects: ["painting"] });
		expect(isInInventory(takePainting.state, "painting")).toBe(true);
		s = takePainting.state;

		// 9. Go north to Studio, up chimney to Kitchen
		s = executeAction(bus, world, s, "go", { direction: "north" }).state;
		expect(s.player.current_room).toBe("studio");
		s = executeAction(bus, world, s, "go", { direction: "up" }).state;
		expect(s.player.current_room).toBe("kitchen");

		// 10. Go up to Attic, take rope and knife, return to Kitchen
		s = executeAction(bus, world, s, "go", { direction: "up" }).state;
		expect(s.player.current_room).toBe("attic");
		s = executeAction(bus, world, s, "take", { objects: ["rope"] }).state;
		s = executeAction(bus, world, s, "take", { objects: ["nasty_knife"] }).state;
		expect(isInInventory(s, "rope")).toBe(true);
		expect(isInInventory(s, "nasty_knife")).toBe(true);
		s = executeAction(bus, world, s, "go", { direction: "down" }).state;
		expect(s.player.current_room).toBe("kitchen");

		// 11. Go west to Living Room, open case, put painting in case
		s = executeAction(bus, world, s, "go", { direction: "west" }).state;
		expect(s.player.current_room).toBe("living_room");
		s = executeAction(bus, world, s, "open", { objects: ["trophy_case"] }).state;
		const putRes = executeAction(bus, world, s, "put", { objects: ["painting", "trophy_case"] });
		expect(putRes.feedback.join(" ")).toContain("Points: 45");
		s = putRes.state;

		// 12. Score command displays current score
		const scoreRes = executeAction(bus, world, s, "score", {});
		expect(scoreRes.feedback.join(" ")).toContain("45 of a possible 350 points");
	});
});
