import type { World } from "../src/world/types";

// ─── Game Data ────────────────────────────────────────────────────────────────

/**
 * "The Forgotten Manor" - A small test game with 4 rooms and a simple puzzle chain:
 *
 * [Entrance Hall] --north--> [Library] (locked, needs brass_key)
 *       |                        |
 *     south                    east
 *       |                        |
 *  [Garden]             [Study] (goal room)
 *
 * Puzzle chain:
 * 1. Examine the painting in the Entrance Hall → reveals a hidden compartment
 * 2. Open the compartment → get the brass key
 * 3. Unlock + open the library door → go north to Library
 * 4. Read the journal in the Library → get the study key
 * 5. Unlock + open the study door → go east to Study
 * 6. Examine the desk in the Study → win condition
 */

const world: World = {
	id: "forgotten_manor",
	name: "The Forgotten Manor",
	version: "1.0.0",
	start_room: "entrance_hall",

	rooms: {
		entrance_hall: {
			id: "entrance_hall",
			name: "Entrance Hall",
			descriptions: {
				default:
					"A grand but dusty entrance hall. Cobwebs hang from the chandelier above. A faded painting of a stern man hangs on the south wall. Exits lead north and south.",
				visited: "The entrance hall. The painting watches you silently.",
			},
			state: { visited: false },
			exits: {
				north: {
					leads_to: "library",
					condition: "library_door.open == true",
					locked_message: "The heavy oak door to the north is firmly locked.",
				},
				south: {
					leads_to: "garden",
				},
			},
			contains: ["painting", "library_door", "compartment"],
		},

		library: {
			id: "library",
			name: "The Library",
			descriptions: {
				default:
					"Floor-to-ceiling bookshelves line the walls, most of the books rotting with age. A reading table sits in the centre with a leather-bound journal on it. A door leads east.",
				visited: "The library. The journal sits where you left it.",
			},
			state: { visited: false },
			exits: {
				south: {
					leads_to: "entrance_hall",
				},
				east: {
					leads_to: "study",
					condition: "study_door.open == true",
					locked_message: "A narrow door to the east is locked tight.",
				},
			},
			contains: ["journal", "study_door", "bookshelf"],
		},

		garden: {
			id: "garden",
			name: "Overgrown Garden",
			descriptions: {
				default:
					"A once-beautiful garden now swallowed by weeds and brambles. A stone bench sits near a dried-up fountain. The manor entrance is back to the north.",
				visited: "The wild garden. Nothing seems to have changed.",
			},
			state: { visited: false },
			exits: {
				north: {
					leads_to: "entrance_hall",
				},
			},
			contains: ["stone_bench", "fountain"],
		},

		study: {
			id: "study",
			name: "The Study",
			descriptions: {
				default:
					"A small, windowless study. A large oak desk dominates the room, covered in papers and an unlit candle. This feels important.",
				visited: "The study. The desk looms before you.",
			},
			state: { visited: false },
			exits: {
				west: {
					leads_to: "library",
				},
			},
			contains: ["oak_desk", "candle"],
		},
	},

	objects: {
		// ── Entrance Hall objects ──────────────────────────────────────────────

		painting: {
			id: "painting",
			name: "faded painting",
			synonyms: ["painting", "portrait", "picture", "stern man"],
			type: "fixture",
			state: { examined: false, carriable: false },
			descriptions: {
				default:
					"A portrait of a stern-looking man in Victorian dress. His eyes seem to follow you. The frame looks slightly loose on one side.",
				examined:
					"On closer inspection, the loose frame conceals a small latch. There's a hidden compartment behind the painting.",
			},
		},

		compartment: {
			id: "compartment",
			name: "hidden compartment",
			synonyms: ["compartment", "hidden compartment", "niche", "hole"],
			type: "container",
			state: { open: false, discovered: false, carriable: false },
			contains: ["brass_key"],
			descriptions: {
				default: "A small recess hidden behind the painting. It's closed.",
				open: "The compartment is open. Inside you can see a brass key.",
				empty: "The compartment is open and empty.",
			},
		},

		brass_key: {
			id: "brass_key",
			name: "brass key",
			synonyms: ["key", "brass key", "small key"],
			type: "key",
			state: { carriable: true },
			descriptions: {
				default:
					"A small brass key, tarnished with age. A label tied to it reads 'Library'.",
			},
		},

		library_door: {
			id: "library_door",
			name: "oak door",
			synonyms: ["door", "oak door", "north door", "library door"],
			type: "door",
			state: { locked: true, open: false, carriable: false },
			requires_instrument: { unlock: "brass_key" },
			descriptions: {
				default: "A heavy oak door with an iron lock. It leads north.",
				unlocked: "The oak door is unlocked but still closed.",
				open: "The oak door stands open, revealing the library beyond.",
			},
		},

		// ── Library objects ────────────────────────────────────────────────────

		journal: {
			id: "journal",
			name: "leather journal",
			synonyms: ["journal", "book", "diary", "leather journal"],
			type: "item",
			state: { read: false, carriable: true },
			contains: ["study_key"],
			descriptions: {
				default:
					"A leather-bound journal, surprisingly well-preserved. The cover reads 'Private — Lord Ashford'. It looks readable.",
				read: "You've already read it. Lord Ashford hid the key to his study inside a hollowed-out book — the journal itself. You notice the back cover is indeed hollow, revealing a small iron key.",
			},
		},

		study_key: {
			id: "study_key",
			name: "iron key",
			synonyms: ["key", "iron key", "study key"],
			type: "key",
			state: { carriable: true },
			descriptions: {
				default:
					"A small iron key hidden inside the back cover of the journal. A faint engraving reads 'Study'.",
			},
		},

		study_door: {
			id: "study_door",
			name: "narrow door",
			synonyms: ["door", "narrow door", "east door", "study door"],
			type: "door",
			state: { locked: true, open: false, carriable: false },
			requires_instrument: { unlock: "study_key" },
			descriptions: {
				default:
					"A narrow wooden door set into the east wall. It has a small iron lock.",
				unlocked: "The narrow door is unlocked but still closed.",
				open: "The narrow door is open, revealing a dark study beyond.",
			},
		},

		bookshelf: {
			id: "bookshelf",
			name: "bookshelf",
			synonyms: ["bookshelf", "shelves", "bookcase", "books"],
			type: "fixture",
			state: { carriable: false },
			descriptions: {
				default:
					"Rows of rotting leather-bound volumes. Most are too degraded to read. Nothing useful catches your eye.",
			},
		},

		// ── Garden objects ─────────────────────────────────────────────────────

		stone_bench: {
			id: "stone_bench",
			name: "stone bench",
			synonyms: ["bench", "stone bench", "seat"],
			type: "fixture",
			state: { carriable: false },
			descriptions: {
				default:
					"A weathered stone bench. Moss has grown into every crack. Comfortable enough for sitting, but there's nothing interesting about it.",
			},
		},

		fountain: {
			id: "fountain",
			name: "stone fountain",
			synonyms: ["fountain", "stone fountain", "basin"],
			type: "fixture",
			state: { carriable: false },
			descriptions: {
				default:
					"A stone fountain, long since dry. A carved fish at the centre once spouted water. Now it just stares blankly at the sky.",
			},
		},

		// ── Study objects ──────────────────────────────────────────────────────

		oak_desk: {
			id: "oak_desk",
			name: "oak desk",
			synonyms: ["desk", "oak desk", "table"],
			type: "fixture",
			state: { examined: false, carriable: false },
			descriptions: {
				default:
					"A large oak desk covered in scattered papers and dust. Something glints beneath the papers.",
				examined:
					"You push aside the papers to reveal a sealed envelope addressed 'To whoever finds this'. Inside is a confession from Lord Ashford. You've uncovered the manor's secret. You win.",
			},
		},

		candle: {
			id: "candle",
			name: "unlit candle",
			synonyms: ["candle", "unlit candle", "taper"],
			type: "item",
			state: { lit: false, carriable: true },
			descriptions: {
				default: "A half-burned candle in a brass holder. It's unlit.",
				lit: "The candle burns with a warm, steady flame.",
			},
		},
	},

	player: {
		current_room: "entrance_hall",
		inventory: [],
		state: {
			moves: 0,
			won: false,
		},
	},
};

export default world;
