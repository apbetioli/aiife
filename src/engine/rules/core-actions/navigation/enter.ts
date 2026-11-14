import type { z } from "zod";
import { getPlayerVehicle, isVehicle, moveObject, setPlayerVehicle } from "../../../mutators";
import { getObjectIds, runAction } from "../helpers";
import { enterSchema } from "../schemas";
import type { ActionDef } from "../types";

const description = "enter(objects): Enter or board a vehicle (e.g. 'board boat', 'enter vehicle', 'get in boat').";

export const enter: ActionDef<z.infer<typeof enterSchema>> = {
	inputSchema: enterSchema,
	description,
	aliases: ["board", "embark", "get in", "climb in", "apply"],
	hint: "Use enter or board to enter a vehicle such as a boat.",
	scope: (ctx) =>
		ctx.in_scope_objects.some(
			(o) =>
				o.type === "vehicle" ||
				o.state?.vehicle === true ||
				o.state?.is_vehicle === true ||
				o.id.includes("boat") ||
				o.aliases?.includes("boat"),
		) || ctx.in_scope_objects.length > 0,
	execute: (params, { state, world, bus, stop }) => {
		// Internal room navigation event ({ room: "..." }) triggered by go action
		if (params.room && (!params.objects || params.objects.length === 0)) {
			return undefined;
		}

		if (state.player.state.dead) {
			stop();
			return "You are dead and cannot do that.";
		}

		const currentVehicle = getPlayerVehicle(state);
		if (currentVehicle) {
			stop();
			const curObj = world.objects[currentVehicle];
			const curName = curObj?.name ?? currentVehicle;
			return `You are already in the ${curName}.`;
		}

		const ids = getObjectIds(params as { objects?: string[] });
		let targetId: string | undefined = ids[0];

		// If no target ID provided, look for a vehicle in the current room
		if (!targetId) {
			const roomVehicles = Object.keys(world.objects).filter((id) => {
				const obj = world.objects[id];
				const objState = state.objects[id];
				return objState?.location === state.player.current_room && isVehicle(obj, objState);
			});
			if (roomVehicles.length === 1) {
				targetId = roomVehicles[0];
			} else if (roomVehicles.length > 1) {
				stop();
				return "Which vehicle do you want to enter?";
			} else {
				stop();
				return "There is nothing here to enter.";
			}
		}

		// Resolve target object by ID, aliases, or name
		let obj = world.objects[targetId];
		let resolvedId = targetId;

		if (!obj) {
			const match = Object.entries(world.objects).find(
				([id, o]) =>
					id.toLowerCase() === targetId?.toLowerCase() ||
					o.name.toLowerCase() === targetId?.toLowerCase() ||
					o.aliases?.some((a) => a.toLowerCase() === targetId?.toLowerCase()),
			);
			if (match) {
				resolvedId = match[0];
				obj = match[1];
			}
		}

		// If still not an object, check if targetId refers to a room accessible from here
		if (!obj) {
			const currentRoom = world.rooms[state.player.current_room];
			if (currentRoom?.exits) {
				// Check for an exit whose leads_to matches targetId, or whose direction is targetId or "in"
				const matchingExit = Object.entries(currentRoom.exits).find(
					([dir, ex]) =>
						ex.leads_to.toLowerCase() === targetId?.toLowerCase() ||
						world.rooms[ex.leads_to]?.name.toLowerCase() === targetId?.toLowerCase() ||
						(dir === targetId?.toLowerCase() && ex.leads_to) ||
						(targetId?.toLowerCase() === "in" && dir === "in"),
				);
				if (matchingExit) {
					return runAction(bus, world, state, "go", { direction: matchingExit[0] });
				}
			}
			stop();
			return "You don't see that here.";
		}

		const objState = state.objects[resolvedId];
		if (!objState) {
			stop();
			return "You don't see that here.";
		}

		// Check if it's a vehicle
		if (!isVehicle(obj, objState)) {
			stop();
			return "You can't enter that.";
		}

		// Check location: must be in current room or inventory
		if (objState.location !== state.player.current_room) {
			if (objState.location === "inventory") {
				moveObject(state, resolvedId, state.player.current_room);
			} else {
				stop();
				return "You don't see that here.";
			}
		}

		if (objState.state.punctured === true) {
			stop();
			return "It is punctured and unusable.";
		}

		setPlayerVehicle(state, resolvedId);
		const feedback = obj.descriptions?.enter ? obj.descriptions.enter : `You are now in the ${obj.name ?? resolvedId}.`;
		return feedback;
	},
};
