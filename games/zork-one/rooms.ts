import type { Room } from "../../src/sdk";

export const rooms: Record<string, Room> = {
	altar: {
		id: "altar",
		name: "Altar",
		descriptions: {
			default:
				"This is the south end of a large temple. In front of you is what appears to be an altar. In one corner is a small hole in the floor which leads into darkness. You probably could not get back up it.",
		},
		state: { lit: true },
		exits: {
			down: {
				leads_to: "tiny_cave",
			},
			north: {
				leads_to: "temple",
			},
		},
	},
	aragain_falls: {
		id: "aragain_falls",
		name: "Aragain Falls",
		descriptions: {
			default:
				"You are at the top of Aragain Falls, an enormous waterfall with a drop of about 450 feet. The only path here is on the north end.",
		},
		state: { lit: true },
		exits: {
			down: {
				leads_to: "aragain_falls",
				condition: "front_door.open == true",
				locked_message: "It's a long way...",
			},
			north: {
				leads_to: "shore",
			},
			up: {
				leads_to: "on_rainbow",
				condition: "rainbow.solid == true",
				locked_message: "The rainbow seems too ethereal to walk upon.",
			},
			west: {
				leads_to: "on_rainbow",
				condition: "rainbow.solid == true",
				locked_message: "The rainbow seems too ethereal to walk upon.",
			},
		},
	},
	atlantis_room: {
		id: "atlantis_room",
		name: "Atlantis Room",
		descriptions: {
			default: "This is an ancient room, long under water. There is an exit to the south and a staircase leading up.",
		},
		state: { lit: false },
		exits: {
			south: {
				leads_to: "reservoir_north",
			},
			up: {
				leads_to: "small_cave",
			},
		},
	},
	attic: {
		id: "attic",
		name: "Attic",
		descriptions: {
			default: "This is the attic. The only exit is a stairway leading down.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "kitchen",
			},
		},
	},
	bat_room: {
		id: "bat_room",
		name: "Bat Room",
		descriptions: {
			default: "You are in a small room which has doors only to the east and south.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "shaft_room",
			},
			south: {
				leads_to: "squeaky_room",
			},
		},
	},
	behind_house: {
		id: "behind_house",
		name: "Behind House",
		descriptions: {
			default:
				"You are behind the white house. A path leads into the forest to the east. In one corner of the house there is a small window which is",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "clearing",
			},
			in: {
				leads_to: "kitchen",
				condition: "kitchen_window.open == true",
				locked_message: "The kitchen window is closed.",
			},
			north: {
				leads_to: "north_of_house",
			},
			northwest: {
				leads_to: "north_of_house",
			},
			south: {
				leads_to: "south_of_house",
			},
			southwest: {
				leads_to: "south_of_house",
			},
			west: {
				leads_to: "kitchen",
				condition: "kitchen_window.open == true",
				locked_message: "The kitchen window is closed.",
			},
		},
	},
	canyon_bottom: {
		id: "canyon_bottom",
		name: "Canyon Bottom",
		descriptions: {
			default:
				"You are beneath the walls of the river canyon which may be climbable here. The lesser part of the runoff of Aragain Falls flows by below. To the north is a narrow path.",
		},
		state: { lit: true },
		exits: {
			north: {
				leads_to: "end_of_rainbow",
			},
			up: {
				leads_to: "rocky_ledge",
			},
		},
	},
	canyon_view: {
		id: "canyon_view",
		name: "Canyon View",
		descriptions: {
			default:
				"You are at the top of the Great Canyon on its west wall. From here there is a marvelous view of the canyon and parts of the Frigid River upstream. Across the canyon, the walls of the White Cliffs join the mighty ramparts of the Flathead Mountains to the east. Following the Canyon upstream to the north, Aragain Falls may be seen, complete with rainbow. The mighty Frigid River flows out from a great dark cavern. To the west and south can be seen an immense forest, stretching for miles around. A path leads northwest. It is possible to climb down into the canyon from here.",
		},
		state: { lit: true },
		exits: {
			down: {
				leads_to: "rocky_ledge",
			},
			east: {
				leads_to: "rocky_ledge",
			},
			northwest: {
				leads_to: "clearing",
			},
			south: {
				leads_to: "canyon_view",
				condition: "front_door.open == true",
				locked_message: "Storm-tossed trees block your way.",
			},
			west: {
				leads_to: "forest_3",
			},
		},
	},
	cellar: {
		id: "cellar",
		name: "Cellar",
		descriptions: {
			default:
				"You are in a dark and damp cellar with a narrow passageway leading north, and a crawlway to the south. On the west is the bottom of a steep metal ramp which is unclimbable.",
		},
		state: { lit: false },
		exits: {
			north: {
				leads_to: "troll_room",
			},
			south: {
				leads_to: "east_of_chasm",
			},
			up: {
				leads_to: "living_room",
				condition: "trap_door.open == true",
				locked_message: "The trap door is closed.",
			},
		},
	},
	chasm: {
		id: "chasm",
		name: "Chasm",
		descriptions: {
			default:
				"A chasm runs southwest to northeast and the path follows it. You are on the south side of the chasm, where a crack opens into a passage.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "chasm",
				condition: "front_door.open == true",
				locked_message: "Are you out of your mind?",
			},
			northeast: {
				leads_to: "reservoir_south",
			},
			south: {
				leads_to: "north_south_passage",
			},
			southwest: {
				leads_to: "east_west_passage",
			},
			up: {
				leads_to: "east_west_passage",
			},
		},
	},
	clearing: {
		id: "clearing",
		name: "Clearing",
		descriptions: {
			default: "You are in a small clearing in a well marked forest path that extends to the east and west.",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "canyon_view",
			},
			north: {
				leads_to: "forest_2",
			},
			south: {
				leads_to: "forest_3",
			},
			up: {
				leads_to: "clearing",
				condition: "front_door.open == true",
				locked_message: "There is no tree here suitable for climbing.",
			},
			west: {
				leads_to: "behind_house",
			},
		},
	},
	coal_mine_1: {
		id: "coal_mine_1",
		name: "Coal Mine",
		descriptions: {
			default: "This is a nondescript part of a coal mine.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "coal_mine_1",
			},
			north: {
				leads_to: "gas_room",
			},
			northeast: {
				leads_to: "coal_mine_2",
			},
		},
	},
	coal_mine_2: {
		id: "coal_mine_2",
		name: "Coal Mine",
		descriptions: {
			default: "This is a nondescript part of a coal mine.",
		},
		state: { lit: false },
		exits: {
			north: {
				leads_to: "coal_mine_2",
			},
			south: {
				leads_to: "coal_mine_1",
			},
			southeast: {
				leads_to: "coal_mine_3",
			},
		},
	},
	coal_mine_3: {
		id: "coal_mine_3",
		name: "Coal Mine",
		descriptions: {
			default: "This is a nondescript part of a coal mine.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "coal_mine_2",
			},
			south: {
				leads_to: "coal_mine_3",
			},
			southwest: {
				leads_to: "coal_mine_4",
			},
		},
	},
	coal_mine_4: {
		id: "coal_mine_4",
		name: "Coal Mine",
		descriptions: {
			default: "This is a nondescript part of a coal mine.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "ladder_top",
			},
			north: {
				leads_to: "coal_mine_3",
			},
			west: {
				leads_to: "coal_mine_4",
			},
		},
	},
	cold_passage: {
		id: "cold_passage",
		name: "Cold Passage",
		descriptions: {
			default: "This is a cold and damp corridor where a long east-west passageway turns into a southward path.",
		},
		state: { lit: false },
		exits: {
			south: {
				leads_to: "mirror_room_south",
			},
			west: {
				leads_to: "slide_room",
			},
		},
	},
	cyclops_room: {
		id: "cyclops_room",
		name: "Cyclops Room",
		descriptions: {
			default: "This room has an exit on the northwest, and a staircase leading up.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "strange_passage",
			},
			northwest: {
				leads_to: "maze_15",
			},
			up: {
				leads_to: "treasure_room",
				condition: "cyclops.fled == true",
				locked_message: "The cyclops blocks your way!",
			},
		},
	},
	dam: {
		id: "dam",
		name: "Dam",
		descriptions: {
			default:
				"You are standing on the top of the Flood Control Dam #3, which was quite a tourist attraction in times far distant. There are paths to the north, south, and west, and a scramble down.",
		},
		state: { lit: true },
		exits: {
			down: {
				leads_to: "dam_base",
			},
			east: {
				leads_to: "dam_base",
			},
			north: {
				leads_to: "dam_lobby",
			},
			south: {
				leads_to: "deep_canyon",
			},
			west: {
				leads_to: "reservoir_south",
			},
		},
	},
	dam_base: {
		id: "dam_base",
		name: "Dam Base",
		descriptions: {
			default:
				"You are at the base of Flood Control Dam #3, which looms above you and to the north. The river Frigid is flowing by here. Along the river are the White Cliffs which seem to form giant walls stretching from north to south along the shores of the river as it winds its way downstream.",
		},
		state: { lit: true },
		exits: {
			north: {
				leads_to: "dam",
			},
			up: {
				leads_to: "dam",
			},
		},
	},
	dam_lobby: {
		id: "dam_lobby",
		name: "Dam Lobby",
		descriptions: {
			default:
				'This room appears to have been the waiting room for groups touring the dam. There are open doorways here to the north and east marked "Private", and there is a path leading south over the top of the dam.',
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "maintenance_room",
			},
			north: {
				leads_to: "maintenance_room",
			},
			south: {
				leads_to: "dam",
			},
		},
	},
	damp_cave: {
		id: "damp_cave",
		name: "Damp Cave",
		descriptions: {
			default:
				"This cave has exits to the west and east, and narrows to a crack toward the south. The earth is particularly damp here.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "white_cliffs_north",
			},
			south: {
				leads_to: "damp_cave",
				condition: "front_door.open == true",
				locked_message: "It is too narrow for most insects.",
			},
			west: {
				leads_to: "loud_room",
			},
		},
	},
	dead_end_1: {
		id: "dead_end_1",
		name: "Dead End",
		descriptions: {
			default: "You have come to a dead end in the maze.",
		},
		state: { lit: false },
		exits: {
			south: {
				leads_to: "maze_4",
			},
		},
	},
	dead_end_2: {
		id: "dead_end_2",
		name: "Dead End",
		descriptions: {
			default: "You have come to a dead end in the maze.",
		},
		state: { lit: false },
		exits: {
			west: {
				leads_to: "maze_5",
			},
		},
	},
	dead_end_3: {
		id: "dead_end_3",
		name: "Dead End",
		descriptions: {
			default: "You have come to a dead end in the maze.",
		},
		state: { lit: false },
		exits: {
			north: {
				leads_to: "maze_8",
			},
		},
	},
	dead_end_4: {
		id: "dead_end_4",
		name: "Dead End",
		descriptions: {
			default: "You have come to a dead end in the maze.",
		},
		state: { lit: false },
		exits: {
			south: {
				leads_to: "maze_12",
			},
		},
	},
	dead_end_5: {
		id: "dead_end_5",
		name: "Dead End",
		descriptions: {
			default: "You have come to a dead end in the mine.",
		},
		state: { lit: false },
		exits: {
			north: {
				leads_to: "ladder_bottom",
			},
		},
	},
	deep_canyon: {
		id: "deep_canyon",
		name: "Deep Canyon",
		descriptions: {
			default:
				"You are on the south edge of a deep canyon. Passages lead off to the east, northwest and southwest. A stairway leads down.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "loud_room",
			},
			east: {
				leads_to: "dam",
			},
			southwest: {
				leads_to: "north_south_passage",
			},
		},
	},
	dome_room: {
		id: "dome_room",
		name: "Dome Room",
		descriptions: {
			default:
				"You are at the periphery of a large dome, which forms the ceiling of another room below. Protecting you from a precipitous drop is a wooden railing which circles the dome.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "torch_room",
				condition: "rope.tied == true",
				locked_message: "You cannot jump down without a rope.",
			},
			west: {
				leads_to: "engravings_cave",
			},
		},
	},
	drafty_room: {
		id: "drafty_room",
		name: "Drafty Room",
		descriptions: {
			default:
				"This is a small drafty room in which is the bottom of a long shaft. To the south is a passageway and to the east a very narrow passage. In the shaft can be seen a heavy iron chain.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "timber_room",
			},
			out: {
				leads_to: "timber_room",
			},
			south: {
				leads_to: "machine_room",
			},
		},
	},
	east_of_chasm: {
		id: "east_of_chasm",
		name: "East of Chasm",
		descriptions: {
			default:
				"You are on the east edge of a chasm, the bottom of which cannot be seen. A narrow passage goes north, and the path you are on continues to the east.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "east_of_chasm",
				condition: "front_door.open == true",
				locked_message: "The chasm probably leads straight to the infernal regions.",
			},
			east: {
				leads_to: "gallery",
			},
			north: {
				leads_to: "cellar",
			},
		},
	},
	east_west_passage: {
		id: "east_west_passage",
		name: "East-West Passage",
		descriptions: {
			default:
				"This is a narrow east-west passageway. There is a narrow stairway leading down at the north end of the room.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "chasm",
			},
			east: {
				leads_to: "round_room",
			},
			north: {
				leads_to: "chasm",
			},
			west: {
				leads_to: "troll_room",
			},
		},
	},
	egyptian_room: {
		id: "egyptian_room",
		name: "Egyptian Room",
		descriptions: {
			default: "This is a room which looks like an Egyptian tomb. There is an ascending staircase to the west.",
		},
		state: { lit: false },
		exits: {
			up: {
				leads_to: "temple",
			},
			west: {
				leads_to: "temple",
			},
		},
	},
	end_of_rainbow: {
		id: "end_of_rainbow",
		name: "End of Rainbow",
		descriptions: {
			default:
				"You are on a small, rocky beach on the continuation of the Frigid River past the Falls. The beach is narrow due to the presence of the White Cliffs. The river canyon opens here and sunlight shines in from above. A rainbow crosses over the falls to the east and a narrow path continues to the southwest.",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "on_rainbow",
				condition: "rainbow.solid == true",
				locked_message: "The rainbow seems too ethereal to walk upon.",
			},
			northeast: {
				leads_to: "on_rainbow",
				condition: "rainbow.solid == true",
				locked_message: "The rainbow seems too ethereal to walk upon.",
			},
			southwest: {
				leads_to: "canyon_bottom",
			},
			up: {
				leads_to: "on_rainbow",
				condition: "rainbow.solid == true",
				locked_message: "The rainbow seems too ethereal to walk upon.",
			},
		},
	},
	engravings_cave: {
		id: "engravings_cave",
		name: "Engravings Cave",
		descriptions: {
			default: "You have entered a low cave with passages leading northwest and east.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "dome_room",
			},
			northwest: {
				leads_to: "round_room",
			},
		},
	},
	entrance_to_hades: {
		id: "entrance_to_hades",
		name: "Entrance to Hades",
		descriptions: {
			default:
				"You are outside a large gateway, on which is inscribed|| Abandon every hope all ye who enter here!|| The gate is open; through it you can see a desolation, with a pile of mangled bodies in one corner. Thousands of voices, lamenting some hideous fate, can be heard.",
		},
		state: { lit: true },
		exits: {
			in: {
				leads_to: "land_of_the_dead",
				condition: "spirits.exorcised == true",
				locked_message: "A host of malevolent spirits blocks your passage.",
			},
			south: {
				leads_to: "land_of_the_dead",
				condition: "spirits.exorcised == true",
				locked_message: "A host of malevolent spirits blocks your passage.",
			},
			up: {
				leads_to: "tiny_cave",
			},
		},
	},
	forest_1: {
		id: "forest_1",
		name: "Forest",
		descriptions: {
			default: "This is a forest, with trees in all directions. To the east, there appears to be sunlight.",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "forest_path",
			},
			north: {
				leads_to: "grating_clearing",
			},
			south: {
				leads_to: "forest_3",
			},
			up: {
				leads_to: "forest_1",
				condition: "front_door.open == true",
				locked_message: "There is no tree here suitable for climbing.",
			},
			west: {
				leads_to: "forest_1",
				condition: "front_door.open == true",
				locked_message: "You would need a machete to go further west.",
			},
		},
	},
	forest_2: {
		id: "forest_2",
		name: "Forest",
		descriptions: {
			default: "This is a dimly lit forest, with large trees all around.",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "forest_mountains",
			},
			north: {
				leads_to: "forest_2",
				condition: "front_door.open == true",
				locked_message: "The forest becomes impenetrable to the north.",
			},
			south: {
				leads_to: "clearing",
			},
			up: {
				leads_to: "forest_2",
				condition: "front_door.open == true",
				locked_message: "There is no tree here suitable for climbing.",
			},
			west: {
				leads_to: "forest_path",
			},
		},
	},
	forest_3: {
		id: "forest_3",
		name: "Forest",
		descriptions: {
			default: "This is a dimly lit forest, with large trees all around.",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "forest_3",
				condition: "front_door.open == true",
				locked_message: "The rank undergrowth prevents eastward movement.",
			},
			north: {
				leads_to: "clearing",
			},
			northwest: {
				leads_to: "south_of_house",
			},
			south: {
				leads_to: "forest_3",
				condition: "front_door.open == true",
				locked_message: "Storm-tossed trees block your way.",
			},
			up: {
				leads_to: "forest_3",
				condition: "front_door.open == true",
				locked_message: "There is no tree here suitable for climbing.",
			},
			west: {
				leads_to: "forest_1",
			},
		},
	},
	forest_mountains: {
		id: "forest_mountains",
		name: "Forest",
		descriptions: {
			default: "The forest thins out, revealing impassable mountains.",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "forest_mountains",
				condition: "front_door.open == true",
				locked_message: "The mountains are impassable.",
			},
			north: {
				leads_to: "forest_2",
			},
			south: {
				leads_to: "forest_2",
			},
			up: {
				leads_to: "forest_mountains",
				condition: "front_door.open == true",
				locked_message: "The mountains are impassable.",
			},
			west: {
				leads_to: "forest_2",
			},
		},
	},
	forest_path: {
		id: "forest_path",
		name: "Forest Path",
		descriptions: {
			default:
				"This is a path winding through a dimly lit forest. The path heads north-south here. One particularly large tree with some low branches stands at the edge of the path.",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "forest_2",
			},
			north: {
				leads_to: "grating_clearing",
			},
			south: {
				leads_to: "north_of_house",
			},
			up: {
				leads_to: "up_a_tree",
			},
			west: {
				leads_to: "forest_1",
			},
		},
	},
	gallery: {
		id: "gallery",
		name: "Gallery",
		descriptions: {
			default:
				"This is an art gallery. Most of the paintings have been stolen by vandals with exceptional taste. The vandals left through either the north or west exits.",
		},
		state: { lit: true },
		exits: {
			north: {
				leads_to: "studio",
			},
			west: {
				leads_to: "east_of_chasm",
			},
		},
	},
	gas_room: {
		id: "gas_room",
		name: "Gas Room",
		descriptions: {
			default:
				"This is a small room which smells strongly of coal gas. There is a short climb up some stairs and a narrow tunnel leading east.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "coal_mine_1",
			},
			up: {
				leads_to: "smelly_room",
			},
		},
	},
	grating_clearing: {
		id: "grating_clearing",
		name: "Clearing",
		descriptions: {
			default: "You are in a clearing, with a forest surrounding you on all sides. A path leads south.",
		},
		state: { lit: true },
		exits: {
			down: {
				leads_to: "grating_room",
				condition: "grating.open == true",
				locked_message: "The grating is closed and locked.",
			},
			east: {
				leads_to: "forest_2",
			},
			north: {
				leads_to: "grating_clearing",
				condition: "front_door.open == true",
				locked_message: "The forest becomes impenetrable to the north.",
			},
			south: {
				leads_to: "forest_path",
			},
			west: {
				leads_to: "forest_1",
			},
		},
	},
	grating_room: {
		id: "grating_room",
		name: "Grating Room",
		descriptions: {
			default: "You are in a small room near the maze. There are twisty passages in the immediate vicinity.",
		},
		state: { lit: false },
		exits: {
			southwest: {
				leads_to: "maze_11",
			},
			up: {
				leads_to: "grating_clearing",
				condition: "grating.open == true",
				locked_message: "The grating is closed and locked.",
			},
		},
	},
	in_stream: {
		id: "in_stream",
		name: "Stream",
		descriptions: {
			default:
				"You are on the gently flowing stream. The upstream route is too narrow to navigate, and the downstream route is invisible due to twisting walls. There is a narrow beach to land on.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "reservoir",
			},
			east: {
				leads_to: "reservoir",
			},
			out: {
				leads_to: "stream_view",
			},
			up: {
				leads_to: "in_stream",
				condition: "front_door.open == true",
				locked_message: "The channel is too narrow.",
			},
			west: {
				leads_to: "in_stream",
				condition: "front_door.open == true",
				locked_message: "The channel is too narrow.",
			},
		},
	},
	kitchen: {
		id: "kitchen",
		name: "Kitchen",
		descriptions: {
			default:
				"You are in the kitchen of the white house. A table seems to have been used recently for the preparation of food. A passage leads to the west and a dark staircase can be seen leading upward. A dark chimney leads down and to the east is a small window which is",
		},
		state: { lit: true },
		exits: {
			down: {
				leads_to: "kitchen",
				condition: "chimney.open == true",
				locked_message: "Only Santa Claus climbs down chimneys.",
			},
			east: {
				leads_to: "behind_house",
				condition: "kitchen_window.open == true",
				locked_message: "The kitchen window is closed.",
			},
			out: {
				leads_to: "behind_house",
				condition: "kitchen_window.open == true",
				locked_message: "The kitchen window is closed.",
			},
			up: {
				leads_to: "attic",
			},
			west: {
				leads_to: "living_room",
			},
		},
	},
	ladder_bottom: {
		id: "ladder_bottom",
		name: "Ladder Bottom",
		descriptions: {
			default:
				"This is a rather wide room. On one side is the bottom of a narrow wooden ladder. To the west and the south are passages leaving the room.",
		},
		state: { lit: false },
		exits: {
			south: {
				leads_to: "dead_end_5",
			},
			up: {
				leads_to: "ladder_top",
			},
			west: {
				leads_to: "timber_room",
			},
		},
	},
	ladder_top: {
		id: "ladder_top",
		name: "Ladder Top",
		descriptions: {
			default:
				"This is a very small room. In the corner is a rickety wooden ladder, leading downward. It might be safe to descend. There is also a staircase leading upward.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "ladder_bottom",
			},
			up: {
				leads_to: "coal_mine_4",
			},
		},
	},
	land_of_the_dead: {
		id: "land_of_the_dead",
		name: "Land of the Dead",
		descriptions: {
			default:
				"You have entered the Land of the Living Dead. Thousands of lost souls can be heard weeping and moaning. In the corner are stacked the remains of dozens of previous adventurers less fortunate than yourself. A passage exits to the north.",
		},
		state: { lit: true },
		exits: {
			north: {
				leads_to: "entrance_to_hades",
			},
			out: {
				leads_to: "entrance_to_hades",
			},
		},
	},
	living_room: {
		id: "living_room",
		name: "Living Room",
		descriptions: {
			default: "You are in the living room. There is a doorway to the east",
		},
		state: { lit: true },
		exits: {
			down: {
				leads_to: "cellar",
				condition: "trap_door.open == true",
				locked_message: "The trap door is closed.",
			},
			east: {
				leads_to: "kitchen",
			},
			west: {
				leads_to: "strange_passage",
				condition: "cyclops.fled == true",
				locked_message: "The door is nailed shut.",
			},
		},
	},
	loud_room: {
		id: "loud_room",
		name: "Loud Room",
		descriptions: {
			default:
				"This is a large room with a ceiling which cannot be detected from the ground. There is a narrow passage from east to west and a stone stairway leading upward.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "damp_cave",
			},
			up: {
				leads_to: "deep_canyon",
			},
			west: {
				leads_to: "round_room",
			},
		},
	},
	machine_room: {
		id: "machine_room",
		name: "Machine Room",
		descriptions: {
			default:
				'This is a large, cold room whose sole exit is to the north. In one corner there is a machine which is reminiscent of a clothes dryer. On its face is a switch which is labelled "START". The switch does not appear to be manipulable by any human hand (unless the fingers are about 1/16 by 1/4 inch). On the front of the machine is a large lid, which is',
		},
		state: { lit: false },
		exits: {
			north: {
				leads_to: "drafty_room",
			},
		},
	},
	maintenance_room: {
		id: "maintenance_room",
		name: "Maintenance Room",
		descriptions: {
			default:
				"This is what appears to have been the maintenance room for Flood Control Dam #3. Apparently, this room has been ransacked recently, for most of the valuable equipment is gone. On the wall in front of you is a group of buttons colored blue, yellow, brown, and red. There are doorways to the west and south.",
		},
		state: { lit: false },
		exits: {
			south: {
				leads_to: "dam_lobby",
			},
			west: {
				leads_to: "dam_lobby",
			},
		},
	},
	maze_1: {
		id: "maze_1",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "troll_room",
			},
			north: {
				leads_to: "maze_1",
			},
			south: {
				leads_to: "maze_2",
			},
			west: {
				leads_to: "maze_4",
			},
		},
	},
	maze_10: {
		id: "maze_10",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "maze_9",
			},
			up: {
				leads_to: "maze_11",
			},
			west: {
				leads_to: "maze_13",
			},
		},
	},
	maze_11: {
		id: "maze_11",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "maze_10",
			},
			northeast: {
				leads_to: "grating_room",
			},
			northwest: {
				leads_to: "maze_13",
			},
			southwest: {
				leads_to: "maze_12",
			},
		},
	},
	maze_12: {
		id: "maze_12",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "maze_5",
			},
			east: {
				leads_to: "maze_13",
			},
			north: {
				leads_to: "dead_end_4",
			},
			southwest: {
				leads_to: "maze_11",
			},
			up: {
				leads_to: "maze_9",
			},
		},
	},
	maze_13: {
		id: "maze_13",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "maze_12",
			},
			east: {
				leads_to: "maze_9",
			},
			south: {
				leads_to: "maze_10",
			},
			west: {
				leads_to: "maze_11",
			},
		},
	},
	maze_14: {
		id: "maze_14",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			northeast: {
				leads_to: "maze_7",
			},
			northwest: {
				leads_to: "maze_14",
			},
			south: {
				leads_to: "maze_7",
			},
			west: {
				leads_to: "maze_15",
			},
		},
	},
	maze_15: {
		id: "maze_15",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			south: {
				leads_to: "maze_7",
			},
			southeast: {
				leads_to: "cyclops_room",
			},
			west: {
				leads_to: "maze_14",
			},
		},
	},
	maze_2: {
		id: "maze_2",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "maze_4",
			},
			east: {
				leads_to: "maze_3",
			},
			south: {
				leads_to: "maze_1",
			},
		},
	},
	maze_3: {
		id: "maze_3",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			north: {
				leads_to: "maze_4",
			},
			up: {
				leads_to: "maze_5",
			},
			west: {
				leads_to: "maze_2",
			},
		},
	},
	maze_4: {
		id: "maze_4",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "dead_end_1",
			},
			north: {
				leads_to: "maze_1",
			},
			west: {
				leads_to: "maze_3",
			},
		},
	},
	maze_5: {
		id: "maze_5",
		name: "Maze",
		descriptions: {
			default:
				"This is part of a maze of twisty little passages, all alike. A skeleton, probably the remains of a luckless adventurer, lies here.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "dead_end_2",
			},
			north: {
				leads_to: "maze_3",
			},
			southwest: {
				leads_to: "maze_6",
			},
		},
	},
	maze_6: {
		id: "maze_6",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "maze_5",
			},
			east: {
				leads_to: "maze_7",
			},
			up: {
				leads_to: "maze_9",
			},
			west: {
				leads_to: "maze_6",
			},
		},
	},
	maze_7: {
		id: "maze_7",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "dead_end_1",
			},
			east: {
				leads_to: "maze_8",
			},
			south: {
				leads_to: "maze_15",
			},
			up: {
				leads_to: "maze_14",
			},
			west: {
				leads_to: "maze_6",
			},
		},
	},
	maze_8: {
		id: "maze_8",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			northeast: {
				leads_to: "maze_7",
			},
			southeast: {
				leads_to: "dead_end_3",
			},
			west: {
				leads_to: "maze_8",
			},
		},
	},
	maze_9: {
		id: "maze_9",
		name: "Maze",
		descriptions: {
			default: "This is part of a maze of twisty little passages, all alike.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "maze_11",
			},
			east: {
				leads_to: "maze_10",
			},
			north: {
				leads_to: "maze_6",
			},
			northwest: {
				leads_to: "maze_9",
			},
			south: {
				leads_to: "maze_13",
			},
			west: {
				leads_to: "maze_12",
			},
		},
	},
	mine_entrance: {
		id: "mine_entrance",
		name: "Mine Entrance",
		descriptions: {
			default:
				"You are standing at the entrance of what might have been a coal mine. The shaft enters the west wall, and there is another exit on the south end of the room.",
		},
		state: { lit: false },
		exits: {
			in: {
				leads_to: "squeaky_room",
			},
			south: {
				leads_to: "slide_room",
			},
			west: {
				leads_to: "squeaky_room",
			},
		},
	},
	mirror_room_north: {
		id: "mirror_room_north",
		name: "Mirror Room",
		descriptions: {
			default:
				"You are in a large square room with tall ceilings. On the south wall is an enormous mirror which fills the entire wall. There are exits on the other three sides of the room.",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "tiny_cave",
			},
			north: {
				leads_to: "narrow_passage",
			},
			west: {
				leads_to: "winding_passage",
			},
		},
	},
	mirror_room_south: {
		id: "mirror_room_south",
		name: "Mirror Room",
		descriptions: {
			default:
				"You are in a large square room with tall ceilings. On the south wall is an enormous mirror which fills the entire wall. There are exits on the other three sides of the room.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "small_cave",
			},
			north: {
				leads_to: "cold_passage",
			},
			west: {
				leads_to: "twisting_passage",
			},
		},
	},
	narrow_passage: {
		id: "narrow_passage",
		name: "Narrow Passage",
		descriptions: {
			default: "This is a long and narrow corridor where a long north-south passageway briefly narrows even further.",
		},
		state: { lit: false },
		exits: {
			north: {
				leads_to: "round_room",
			},
			south: {
				leads_to: "mirror_room_north",
			},
		},
	},
	north_of_house: {
		id: "north_of_house",
		name: "North of House",
		descriptions: {
			default:
				"You are facing the north side of a white house. There is no door here, and all the windows are boarded up. To the north a narrow path winds through the trees.",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "behind_house",
			},
			north: {
				leads_to: "forest_path",
			},
			south: {
				leads_to: "north_of_house",
				condition: "kitchen_window.open == true",
				locked_message: "The windows are all boarded.",
			},
			southeast: {
				leads_to: "behind_house",
			},
			southwest: {
				leads_to: "west_of_house",
			},
			west: {
				leads_to: "west_of_house",
			},
		},
	},
	north_south_passage: {
		id: "north_south_passage",
		name: "North-South Passage",
		descriptions: {
			default: "This is a high north-south passage, which forks to the northeast.",
		},
		state: { lit: false },
		exits: {
			north: {
				leads_to: "chasm",
			},
			northeast: {
				leads_to: "deep_canyon",
			},
			south: {
				leads_to: "round_room",
			},
		},
	},
	on_rainbow: {
		id: "on_rainbow",
		name: "On the Rainbow",
		descriptions: {
			default:
				"You are on top of a rainbow (I bet you never thought you would walk on a rainbow), with a magnificent view of the Falls. The rainbow travels east-west here.",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "aragain_falls",
			},
			west: {
				leads_to: "end_of_rainbow",
			},
		},
	},
	reservoir: {
		id: "reservoir",
		name: "Reservoir",
		descriptions: {
			default:
				"You notice that the water level here is rising rapidly. The currents are also becoming stronger. Staying here seems quite perilous!",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "reservoir",
				condition: "front_door.open == true",
				locked_message: "The dam blocks your way.",
			},
			north: {
				leads_to: "reservoir_north",
				condition: "reservoir.drained == true",
				locked_message: "The reservoir is deep and full of water. You would drown.",
			},
			south: {
				leads_to: "reservoir_south",
				condition: "reservoir.drained == true",
				locked_message: "The reservoir is deep and full of water. You would drown.",
			},
			up: {
				leads_to: "in_stream",
			},
			west: {
				leads_to: "in_stream",
			},
		},
	},
	reservoir_north: {
		id: "reservoir_north",
		name: "Reservoir North",
		descriptions: {
			default:
				"You are in a large cavernous room, the south of which was formerly a lake. However, with the water level lowered, there is merely a wide stream running through there.",
		},
		state: { lit: false },
		exits: {
			north: {
				leads_to: "atlantis_room",
			},
			south: {
				leads_to: "reservoir",
				condition: "reservoir.drained == true",
				locked_message: "The reservoir is deep and full of water. You would drown.",
			},
		},
	},
	reservoir_south: {
		id: "reservoir_south",
		name: "Reservoir South",
		descriptions: {
			default:
				"You are in a long room, to the north of which was formerly a lake. However, with the water level lowered, there is merely a wide stream running through the center of the room.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "dam",
			},
			north: {
				leads_to: "reservoir",
				condition: "reservoir.drained == true",
				locked_message: "The reservoir is deep and full of water. You would drown.",
			},
			southeast: {
				leads_to: "deep_canyon",
			},
			southwest: {
				leads_to: "chasm",
			},
			west: {
				leads_to: "stream_view",
			},
		},
	},
	river_1: {
		id: "river_1",
		name: "Frigid River",
		descriptions: {
			default:
				"You are on the Frigid River in the vicinity of the Dam. The river flows quietly here. There is a landing on the west shore.",
		},
		state: { lit: true },
		exits: {
			down: {
				leads_to: "river_2",
			},
			east: {
				leads_to: "river_1",
				condition: "front_door.open == true",
				locked_message: "The White Cliffs prevent your landing here.",
			},
			out: {
				leads_to: "dam_base",
			},
			up: {
				leads_to: "river_1",
				condition: "front_door.open == true",
				locked_message: "You cannot go upstream due to strong currents.",
			},
			west: {
				leads_to: "dam_base",
			},
		},
	},
	river_2: {
		id: "river_2",
		name: "Frigid River",
		descriptions: {
			default:
				"The river turns a corner here making it impossible to see the Dam. The White Cliffs loom on the east bank and large rocks prevent landing on the west.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "river_3",
			},
			east: {
				leads_to: "river_2",
				condition: "front_door.open == true",
				locked_message: "The White Cliffs prevent your landing here.",
			},
			out: {
				leads_to: "river_2",
				condition: "front_door.open == true",
				locked_message: "There is no safe landing spot here.",
			},
			up: {
				leads_to: "river_2",
				condition: "front_door.open == true",
				locked_message: "You cannot go upstream due to strong currents.",
			},
			west: {
				leads_to: "river_2",
				condition: "front_door.open == true",
				locked_message: "Just in time you steer away from the rocks.",
			},
		},
	},
	river_3: {
		id: "river_3",
		name: "Frigid River",
		descriptions: {
			default:
				"The river descends here into a valley. There is a narrow beach on the west shore below the cliffs. In the distance a faint rumbling can be heard.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "river_4",
			},
			out: {
				leads_to: "white_cliffs_north",
			},
			up: {
				leads_to: "river_3",
				condition: "front_door.open == true",
				locked_message: "You cannot go upstream due to strong currents.",
			},
			west: {
				leads_to: "white_cliffs_north",
			},
		},
	},
	river_4: {
		id: "river_4",
		name: "Frigid River",
		descriptions: {
			default:
				"The river is running faster here and the sound ahead appears to be that of rushing water. On the east shore is a sandy beach. A small area of beach can also be seen below the cliffs on the west shore.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "river_5",
			},
			east: {
				leads_to: "sandy_beach",
			},
			out: {
				leads_to: "river_4",
				condition: "front_door.open == true",
				locked_message: "You can land either to the east or the west.",
			},
			up: {
				leads_to: "river_4",
				condition: "front_door.open == true",
				locked_message: "You cannot go upstream due to strong currents.",
			},
			west: {
				leads_to: "white_cliffs_south",
			},
		},
	},
	river_5: {
		id: "river_5",
		name: "Frigid River",
		descriptions: {
			default: "The sound of rushing water is nearly unbearable here. On the east shore is a large landing area.",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "shore",
			},
			out: {
				leads_to: "shore",
			},
			up: {
				leads_to: "river_5",
				condition: "front_door.open == true",
				locked_message: "You cannot go upstream due to strong currents.",
			},
		},
	},
	rocky_ledge: {
		id: "rocky_ledge",
		name: "Rocky Ledge",
		descriptions: {
			default:
				"You are on a ledge about halfway up the wall of the river canyon. You can see from here that the main flow from Aragain Falls twists along a passage which it is impossible for you to enter. Below you is the canyon bottom. Above you is more cliff, which appears climbable.",
		},
		state: { lit: true },
		exits: {
			down: {
				leads_to: "canyon_bottom",
			},
			up: {
				leads_to: "canyon_view",
			},
		},
	},
	round_room: {
		id: "round_room",
		name: "Round Room",
		descriptions: {
			default:
				"This is a circular stone room with passages in all directions. Several of them have unfortunately been blocked by cave-ins.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "loud_room",
			},
			north: {
				leads_to: "north_south_passage",
			},
			south: {
				leads_to: "narrow_passage",
			},
			southeast: {
				leads_to: "engravings_cave",
			},
			west: {
				leads_to: "east_west_passage",
			},
		},
	},
	sandy_beach: {
		id: "sandy_beach",
		name: "Sandy Beach",
		descriptions: {
			default:
				"You are on a large sandy beach on the east shore of the river, which is flowing quickly by. A path runs beside the river to the south here, and a passage is partially buried in sand to the northeast.",
		},
		state: { lit: false },
		exits: {
			northeast: {
				leads_to: "sandy_cave",
			},
			south: {
				leads_to: "shore",
			},
		},
	},
	sandy_cave: {
		id: "sandy_cave",
		name: "Sandy Cave",
		descriptions: {
			default: "This is a sand-filled cave whose exit is to the southwest.",
		},
		state: { lit: false },
		exits: {
			southwest: {
				leads_to: "sandy_beach",
			},
		},
	},
	shaft_room: {
		id: "shaft_room",
		name: "Shaft Room",
		descriptions: {
			default:
				"This is a large room, in the middle of which is a small shaft descending through the floor into darkness below. To the west and the north are exits from this room. Constructed over the top of the shaft is a metal framework to which a heavy iron chain is attached.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "shaft_room",
				condition: "front_door.open == true",
				locked_message: "You wouldn't fit and would die if you could.",
			},
			north: {
				leads_to: "smelly_room",
			},
			west: {
				leads_to: "bat_room",
			},
		},
	},
	shore: {
		id: "shore",
		name: "Shore",
		descriptions: {
			default:
				"You are on the east shore of the river. The water here seems somewhat treacherous. A path travels from north to south here, the south end quickly turning around a sharp corner.",
		},
		state: { lit: true },
		exits: {
			north: {
				leads_to: "sandy_beach",
			},
			south: {
				leads_to: "aragain_falls",
			},
		},
	},
	slide_room: {
		id: "slide_room",
		name: "Slide Room",
		descriptions: {
			default:
				'This is a small chamber, which appears to have been part of a coal mine. On the south wall of the chamber the letters "Granite Wall" are etched in the rock. To the east is a long passage, and there is a steep metal slide twisting downward. To the north is a small opening.',
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "cellar",
			},
			east: {
				leads_to: "cold_passage",
			},
			north: {
				leads_to: "mine_entrance",
			},
		},
	},
	small_cave: {
		id: "small_cave",
		name: "Cave",
		descriptions: {
			default: "This is a tiny cave with entrances west and north, and a staircase leading down.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "atlantis_room",
			},
			north: {
				leads_to: "mirror_room_south",
			},
			south: {
				leads_to: "atlantis_room",
			},
			west: {
				leads_to: "twisting_passage",
			},
		},
	},
	smelly_room: {
		id: "smelly_room",
		name: "Smelly Room",
		descriptions: {
			default:
				"This is a small nondescript room. However, from the direction of a small descending staircase a foul odor can be detected. To the south is a narrow tunnel.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "gas_room",
			},
			south: {
				leads_to: "shaft_room",
			},
		},
	},
	south_of_house: {
		id: "south_of_house",
		name: "South of House",
		descriptions: {
			default:
				"You are facing the south side of a white house. There is no door here, and all the windows are boarded.",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "behind_house",
			},
			north: {
				leads_to: "south_of_house",
				condition: "kitchen_window.open == true",
				locked_message: "The windows are all boarded.",
			},
			northeast: {
				leads_to: "behind_house",
			},
			northwest: {
				leads_to: "west_of_house",
			},
			south: {
				leads_to: "forest_3",
			},
			west: {
				leads_to: "west_of_house",
			},
		},
	},
	squeaky_room: {
		id: "squeaky_room",
		name: "Squeaky Room",
		descriptions: {
			default:
				"You are in a small room. Strange squeaky sounds may be heard coming from the passage at the north end. You may also escape to the east.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "mine_entrance",
			},
			north: {
				leads_to: "bat_room",
			},
		},
	},
	stone_barrow: {
		id: "stone_barrow",
		name: "Stone Barrow",
		descriptions: {
			default:
				"You are standing in front of a massive barrow of stone. In the east face is a huge stone door which is open. You cannot see into the dark of the tomb.",
		},
		state: { lit: true },
		exits: {
			northeast: {
				leads_to: "west_of_house",
			},
		},
	},
	strange_passage: {
		id: "strange_passage",
		name: "Strange Passage",
		descriptions: {
			default:
				"This is a long passage. To the west is one entrance. On the east there is an old wooden door, with a large opening in it (about cyclops sized).",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "living_room",
				condition: "cyclops.fled == true",
				locked_message: "The door to the living room is nailed shut.",
			},
			in: {
				leads_to: "cyclops_room",
			},
			west: {
				leads_to: "cyclops_room",
			},
		},
	},
	stream_view: {
		id: "stream_view",
		name: "Stream View",
		descriptions: {
			default:
				"You are standing on a path beside a gently flowing stream. The path follows the stream, which flows from west to east.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "reservoir_south",
			},
			west: {
				leads_to: "stream_view",
				condition: "front_door.open == true",
				locked_message: "The stream emerges from a spot too small for you to enter.",
			},
		},
	},
	studio: {
		id: "studio",
		name: "Studio",
		descriptions: {
			default:
				"This appears to have been an artist's studio. The walls and floors are splattered with paints of 69 different colors. Strangely enough, nothing of value is hanging here. At the south end of the room is an open door (also covered with paint). A dark and narrow chimney leads up from a fireplace; although you might be able to get up it, it seems unlikely you could get back down.",
		},
		state: { lit: false },
		exits: {
			south: {
				leads_to: "gallery",
			},
			up: {
				leads_to: "kitchen",
			},
		},
	},
	temple: {
		id: "temple",
		name: "Temple",
		descriptions: {
			default:
				"This is the north end of a large temple. On the east wall is an ancient inscription, probably a prayer in a long-forgotten language. Below the prayer is a staircase leading down. The west wall is solid granite. The exit to the north end of the room is through huge marble pillars.",
		},
		state: { lit: true },
		exits: {
			down: {
				leads_to: "egyptian_room",
			},
			east: {
				leads_to: "egyptian_room",
			},
			north: {
				leads_to: "torch_room",
			},
			out: {
				leads_to: "torch_room",
			},
			south: {
				leads_to: "altar",
			},
			up: {
				leads_to: "torch_room",
			},
		},
	},
	timber_room: {
		id: "timber_room",
		name: "Timber Room",
		descriptions: {
			default:
				"This is a long and narrow passage, which is cluttered with broken timbers. A wide passage comes from the east and turns at the west end of the room into a very narrow passageway. From the west comes a strong draft.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "ladder_bottom",
			},
			west: {
				leads_to: "drafty_room",
			},
		},
	},
	tiny_cave: {
		id: "tiny_cave",
		name: "Cave",
		descriptions: {
			default: "This is a tiny cave with entrances west and north, and a dark, forbidding staircase leading down.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "entrance_to_hades",
			},
			north: {
				leads_to: "mirror_room_north",
			},
			west: {
				leads_to: "winding_passage",
			},
		},
	},
	torch_room: {
		id: "torch_room",
		name: "Torch Room",
		descriptions: {
			default:
				"This is a large room with a prominent doorway leading to a down staircase. Above you is a large dome. Up around the edge of the dome (20 feet up) is a wooden railing. In the center of the room sits a white marble pedestal.",
		},
		state: { lit: false },
		exits: {
			down: {
				leads_to: "temple",
			},
			south: {
				leads_to: "temple",
			},
			up: {
				leads_to: "dome_room",
				condition: "rope.tied == true",
				locked_message: "You cannot climb up without a rope.",
			},
		},
	},
	treasure_room: {
		id: "treasure_room",
		name: "Treasure Room",
		descriptions: {
			default:
				"This is a large room, whose east wall is solid granite. A number of discarded bags, which crumble at your touch, are scattered about on the floor. There is an exit down a staircase.",
		},
		state: { lit: true },
		exits: {
			down: {
				leads_to: "cyclops_room",
			},
		},
	},
	troll_room: {
		id: "troll_room",
		name: "The Troll Room",
		descriptions: {
			default:
				"This is a small room with passages to the east and south and a forbidding hole leading west. Bloodstains and deep scratches (perhaps made by an axe) mar the walls.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "east_west_passage",
				condition: "troll.dead == true",
				locked_message: "The troll blocks your way east with a menacing snarl!",
			},
			north: {
				leads_to: "east_west_passage",
				condition: "troll.dead == true",
				locked_message: "The troll blocks your way north with a menacing snarl!",
			},
			south: {
				leads_to: "cellar",
			},
			west: {
				leads_to: "maze_1",
			},
		},
	},
	twisting_passage: {
		id: "twisting_passage",
		name: "Twisting Passage",
		descriptions: {
			default: "This is a winding passage. It seems that there are only exits on the east and north.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "small_cave",
			},
			north: {
				leads_to: "mirror_room_south",
			},
		},
	},
	up_a_tree: {
		id: "up_a_tree",
		name: "Up a Tree",
		descriptions: {
			default:
				"You are about 10 feet above the ground nestled among some large branches. The nearest branch above you is above your reach.",
		},
		state: { lit: true },
		exits: {
			down: {
				leads_to: "forest_path",
			},
			up: {
				leads_to: "up_a_tree",
				condition: "front_door.open == true",
				locked_message: "You cannot climb any higher.",
			},
		},
	},
	west_of_house: {
		id: "west_of_house",
		name: "West of House",
		descriptions: {
			default: "You are standing in an open field west of a white house, with a boarded front door.",
		},
		state: { lit: true },
		exits: {
			east: {
				leads_to: "west_of_house",
				condition: "front_door.open == true",
				locked_message: "The door is boarded and you can't remove the boards.",
			},
			in: {
				leads_to: "stone_barrow",
				condition: "front_door.open == true",
				locked_message: "The path is blocked.",
			},
			north: {
				leads_to: "north_of_house",
			},
			northeast: {
				leads_to: "north_of_house",
			},
			south: {
				leads_to: "south_of_house",
			},
			southeast: {
				leads_to: "south_of_house",
			},
			southwest: {
				leads_to: "stone_barrow",
				condition: "front_door.open == true",
				locked_message: "The path is blocked.",
			},
			west: {
				leads_to: "forest_1",
			},
		},
	},
	white_cliffs_north: {
		id: "white_cliffs_north",
		name: "White Cliffs Beach",
		descriptions: {
			default:
				"You are on a narrow strip of beach which runs along the base of the White Cliffs. There is a narrow path heading south along the Cliffs and a tight passage leading west into the cliffs themselves.",
		},
		state: { lit: false },
		exits: {
			south: {
				leads_to: "white_cliffs_south",
			},
			west: {
				leads_to: "damp_cave",
			},
		},
	},
	white_cliffs_south: {
		id: "white_cliffs_south",
		name: "White Cliffs Beach",
		descriptions: {
			default:
				"You are on a rocky, narrow strip of beach beside the Cliffs. A narrow path leads north along the shore.",
		},
		state: { lit: false },
		exits: {
			north: {
				leads_to: "white_cliffs_north",
			},
		},
	},
	winding_passage: {
		id: "winding_passage",
		name: "Winding Passage",
		descriptions: {
			default: "This is a winding passage. It seems that there are only exits on the east and north.",
		},
		state: { lit: false },
		exits: {
			east: {
				leads_to: "tiny_cave",
			},
			north: {
				leads_to: "mirror_room_north",
			},
		},
	},
};
