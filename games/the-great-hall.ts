import type { World } from "../src/world/types";

const world: World = {
	id: "the_great_hall",
	name: "The Great Hall",
	version: "1.0.0",
	start_room: "great_hall",
	rooms: {
		great_hall: {
			id: "great_hall",
			name: "The Great Hall",
			descriptions: {
				default:
					"You stand in a vast stone hall. Faded tapestries line the walls, depicting scenes of forgotten battles. A grand staircase spirals upward, and a heavy iron door is set into the floor. Passages lead north and west.",
			},
			state: {},
			exits: {
				north: { leads_to: "library", condition: null },
				west: { leads_to: "garden", condition: null },
				up: { leads_to: "tower_room", condition: null },
				down: {
					leads_to: "cellar",
					condition: "cellar_door.open == true",
					locked_message: "The heavy iron door in the floor is locked.",
				},
			},
			contains: ["brass_lantern", "cellar_door"],
		},
		garden: {
			id: "garden",
			name: "The Garden",
			descriptions: {
				default:
					"A walled garden, overgrown but still beautiful. Wildflowers push through cracked flagstones, and ivy climbs the ancient walls. The Great Hall lies to the east.",
			},
			state: {},
			exits: {
				east: { leads_to: "great_hall", condition: null },
			},
			contains: ["gardener"],
		},
		library: {
			id: "library",
			name: "The Library",
			descriptions: {
				default:
					"Floor-to-ceiling bookshelves crowd this dusty room. Most of the books have crumbled to dust, but a few leather-bound volumes remain. A curious alcove is set into the far wall. The Great Hall is to the south.",
			},
			state: {},
			exits: {
				south: { leads_to: "great_hall", condition: null },
			},
			contains: ["old_book", "alcove"],
		},
		tower_room: {
			id: "tower_room",
			name: "The Tower Room",
			descriptions: {
				default:
					"A circular room at the top of the spiral staircase. Wind whistles through narrow arrow slits. An ornate wooden chest sits against the wall. Stairs lead back down.",
			},
			state: {},
			exits: {
				down: { leads_to: "great_hall", condition: null },
			},
			contains: ["wooden_chest"],
		},
		cellar: {
			id: "cellar",
			name: "The Cellar",
			descriptions: {
				default:
					"A cold, damp cellar beneath the Great Hall. Water drips from the low ceiling. In the center of the room, a stone pedestal rises from the floor, covered in strange runes. Stairs lead back up.",
			},
			state: {},
			exits: {
				up: { leads_to: "great_hall", condition: null },
			},
			contains: ["stone_pedestal"],
		},
	},
	objects: {
		brass_lantern: {
			id: "brass_lantern",
			name: "brass lantern",
			synonyms: ["lantern", "lamp", "light"],
			type: "item",
			state: { carriable: true },
			descriptions: {
				default: "A sturdy brass lantern. It casts a warm, steady glow.",
			},
		},
		old_book: {
			id: "old_book",
			name: "old book",
			synonyms: ["book", "leather book", "volume"],
			type: "item",
			state: { carriable: true },
			descriptions: {
				default:
					'A crumbling leather-bound book. The only legible passage reads: "...and the amulet shall rest upon the pedestal, and the way shall be opened..."',
			},
		},
		alcove: {
			id: "alcove",
			name: "alcove",
			synonyms: ["shadowy alcove", "wall alcove", "recess"],
			type: "container",
			state: { revealed: false, carriable: false },
			descriptions: {
				default:
					"A shadowy alcove set into the wall. You might look more closely.",
			},
			contains: ["rusty_key"],
		},
		rusty_key: {
			id: "rusty_key",
			name: "rusty key",
			synonyms: ["key", "iron key", "old key"],
			type: "key",
			state: { carriable: true },
			descriptions: {
				default:
					"A rusty iron key, cold to the touch. It looks like it might fit a heavy lock.",
			},
		},
		wooden_chest: {
			id: "wooden_chest",
			name: "wooden chest",
			synonyms: ["chest", "ornate chest", "box"],
			type: "container",
			state: { open: false, carriable: false },
			descriptions: {
				default: "An ornate wooden chest with iron bindings. It is closed.",
				open: "An ornate wooden chest with iron bindings. It is open and empty.",
			},
			contains: ["gold_amulet"],
		},
		gold_amulet: {
			id: "gold_amulet",
			name: "gold amulet",
			synonyms: ["amulet", "golden amulet", "necklace"],
			type: "item",
			state: { carriable: true },
			descriptions: {
				default:
					"A gleaming gold amulet on a fine chain. Strange runes are etched into its surface, matching those on a pedestal somewhere below.",
			},
		},
		stone_pedestal: {
			id: "stone_pedestal",
			name: "stone pedestal",
			synonyms: ["pedestal", "altar", "runes"],
			type: "fixture",
			state: { carriable: false },
			descriptions: {
				default:
					"A waist-high stone pedestal covered in ancient runes. There is a shallow, circular depression on its top surface — just the right size for an amulet.",
			},
		},
		cellar_door: {
			id: "cellar_door",
			name: "heavy iron door",
			synonyms: ["iron door", "door", "floor door", "trapdoor"],
			type: "door",
			state: { open: false, carriable: false },
			descriptions: {
				default: "A heavy iron door set into the floor. It is locked.",
				open: "The heavy iron door in the floor stands open, revealing stone steps descending into darkness.",
			},
			requires_instrument: { unlock: "rusty_key" },
		},
		gardener: {
			id: "gardener",
			name: "old gardener",
			synonyms: ["gardener", "old man", "man"],
			type: "actor",
			state: { carriable: false },
			descriptions: {
				default:
					"A weathered old man in dirt-stained clothes, tending to the wildflowers with surprising care. He might have a hint about the library alcove.",
			},
		},
	},
	player: {
		current_room: "great_hall",
		inventory: [],
		state: {},
	},
};

export default world;
