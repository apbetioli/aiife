import { PRIORITY } from "../src/engine/rules/priorities";
import { defineGame, type World } from "../src/world";

const world: World = {
	id: "zork-one",
	name: "Zork One",
	version: "1.0.0",
	start_room: "west_of_house",
	welcome: "**ZORK**\n\nWelcome to ZORK.\nRelease 13 / Serial number 040826 / Inform v6.14 Library 6/7",
	rooms: {
		west_of_house: {
			id: "west_of_house",
			name: "West of House",
			descriptions: {
				default: "You are standing in an open field west of a white house, with a boarded front door.",
			},
			state: {},
			exits: {
				east: {
					leads_to: "west_of_house",
					condition: "front_door.open == true",
					locked_message: "The door is boarded and you can't remove the boards.",
				},
			},
		},
	},
	objects: {
		small_mailbox: {
			id: "small_mailbox",
			name: "small mailbox",
			aliases: ["mailbox", "box"],
			type: "container",
			location: "west_of_house",
			state: { open: false, carriable: false },
			descriptions: {
				default: "There is a small mailbox here.",
				open: "A small mailbox is here. It is open.",
			},
		},
		leaflet: {
			id: "leaflet",
			name: "leaflet",
			aliases: ["mail", "paper", "booklet", "pamphlet"],
			type: "item",
			location: "small_mailbox",
			state: { carriable: true },
			descriptions: {
				default:
					'"WELCOME TO ZORK!\n\nZORK is a game of adventure, danger, and low cunning. In it you will explore some of the most amazing territory ever seen by mortals. No computer should be without one!"',
			},
		},
		front_door: {
			id: "front_door",
			name: "front door",
			aliases: ["door", "boarded door", "boards", "board"],
			type: "fixture",
			location: "west_of_house",
			state: {
				scenery: true,
				open: false,
				carriable: false,
			},
			descriptions: {
				default: "The front door of the white house. It is firmly boarded shut and cannot be opened.",
			},
		},
	},
	player: {
		current_room: "west_of_house",
		inventory: [],
		state: {},
	},
};

const game = defineGame({
	world,
	setup(bus) {
		bus.on(
			"open",
			"front_door",
			(event) => {
				event.stop();
				return "The door cannot be opened.";
			},
			{ priority: PRIORITY.GUARD },
		);
	},
});

export default game;
export { world };
export const setup = game.setup;
