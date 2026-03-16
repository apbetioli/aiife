import type { World } from "../../world/types";

/**
 * Minimal valid world for unit tests.
 * Two rooms, a few objects, one conditional exit.
 */
export function makeTestWorld(overrides?: Partial<World>): World {
	return {
		id: "test_world",
		name: "Test World",
		version: "1.0.0",
		start_room: "room_a",

		rooms: {
			room_a: {
				id: "room_a",
				name: "Room A",
				descriptions: {
					default: "You are in room A.",
					visited: "Room A again.",
					dark: "Room A is dark.",
				},
				state: { visited: false },
				exits: {
					north: {
						leads_to: "room_b",
						condition: "door.open == true",
						locked_message: "The door is locked.",
					},
					south: {
						leads_to: "room_b",
					},
				},
				contains: ["door", "lamp", "chest"],
			},

			room_b: {
				id: "room_b",
				name: "Room B",
				descriptions: {
					default: "You are in room B.",
					visited: "Room B again.",
				},
				state: { visited: false },
				exits: {
					south: {
						leads_to: "room_a",
					},
				},
				contains: ["table"],
			},
		},

		objects: {
			door: {
				id: "door",
				name: "wooden door",
				aliases: [],
				type: "door",
				state: { locked: true, open: false, carriable: false },
				descriptions: { default: "A wooden door." },
			},

			lamp: {
				id: "lamp",
				name: "brass lamp",
				aliases: [],
				type: "item",
				state: { lit: false, carriable: true },
				descriptions: { default: "A brass lamp." },
			},

			chest: {
				id: "chest",
				name: "wooden chest",
				aliases: [],
				type: "container",
				state: { open: false, carriable: false },
				contains: ["gem"],
				descriptions: { default: "A wooden chest." },
			},

			gem: {
				id: "gem",
				name: "red gem",
				aliases: [],
				type: "item",
				state: { carriable: true },
				descriptions: { default: "A red gem." },
			},

			table: {
				id: "table",
				name: "oak table",
				aliases: [],
				type: "fixture",
				state: { carriable: false },
				descriptions: { default: "An oak table." },
			},

			sword: {
				id: "sword",
				name: "iron sword",
				aliases: [],
				type: "weapon",
				state: { sharp: true, carriable: true },
				descriptions: { default: "An iron sword." },
			},
		},

		player: {
			current_room: "room_a",
			inventory: ["sword"],
			state: { moves: 0 },
		},

		...overrides,
	};
}
