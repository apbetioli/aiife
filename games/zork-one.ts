import type { World } from "../src/world/types";

const world: World = {
	id: "zork-one",
	name: "Zork One",
	version: "1.0.0",
	start_room: "west_of_house",
	rooms: {
		west_of_house: {
			id: "west_of_house",
			name: "West of House",
			descriptions: {
				default: "You are standing in an open field west of a white house, with a boarded front door.",
			},
			state: {},
			exits: {},
		},
	},
	objects: {
		small_mailbox: {
			id: "small_mailbox",
			name: "small mailbox",
			aliases: [],
			type: "container",
			location: "west_of_house",
			state: { carriable: false },
			descriptions: {
				default: "A small mailbox, barely large enough for a few letters.",
			},
		},
		front_door: {
			id: "front_door",
			name: "front door",
			aliases: [],
			type: "door",
			location: "west_of_house",
			state: { open: false, carriable: false },
			descriptions: {
				default: "The front door of the white house. It is firmly boarded shut and cannot be opened.",
				open: "The front door stands open.",
			},
		},
	},
	player: {
		current_room: "west_of_house",
		inventory: [],
		state: {},
	},
};

export default world;
