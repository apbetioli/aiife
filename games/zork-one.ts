import { defineGame, type World } from "../src/sdk";
import { objects } from "./zork-one/objects";
import { rooms } from "./zork-one/rooms";
import { setupZorkRules } from "./zork-one/rules";

const world: World = {
	id: "zork-one",
	name: "Zork One",
	version: "1.0.0",
	start_room: "west_of_house",
	welcome: "**ZORK**\n\nWelcome to ZORK.\nRelease 13 / Serial number 040826 / Inform v6.14 Library 6/7",
	rooms,
	objects,
	player: {
		current_room: "west_of_house",
		state: {},
	},
};

export default defineGame({
	world,
	setup: setupZorkRules,
});
