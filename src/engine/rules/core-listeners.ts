import {
	ensureVisited,
	findOpenContainerInRoom,
	isInInventory,
	isInRoom,
	moveObjectFromContainerToInventory,
	moveObjectFromInventoryToRoom,
	moveObjectFromRoomToInventory,
	movePlayer,
	setObjectState,
	setPlayerState,
} from "../mutators";
import { evaluateCondition, resolveObjectDescriptionWithPreposition, resolveRoomDescription } from "../parser-context";
import type { ActionRegistry } from "./action-registry";
import type { EventBus } from "./event-bus";
import { executeAction } from "./executor";
import { getInstrument, getObjectIds, getTarget } from "./param-helpers";

export function registerCoreHandlers(bus: EventBus, _registry: ActionRegistry): void {
	// ── take ──────────────────────────────────────────────────────────────

	bus.on("take", (event, state, _world) => {
		const ids = getObjectIds(event.params);
		if (ids.length === 0) {
			event.stop("Take what?");
			return state;
		}

		if (state.player.state.dead) {
			event.stop("Your hand passes through its object.");
			return state;
		}

		const canTake = (id: string) => state.objects[id]?.state.carriable !== false && !isInInventory(state, id);

		const fromRoom = ids.filter((id) => isInRoom(state, id) && canTake(id));
		const fromContainer: { id: string; containerId: string }[] = [];
		for (const id of ids) {
			if (fromRoom.includes(id)) continue;
			if (!canTake(id)) continue;
			const cid = findOpenContainerInRoom(state, id);
			if (cid) fromContainer.push({ id, containerId: cid });
		}

		if (fromRoom.length === 0 && fromContainer.length === 0) {
			if (ids.some((id) => isInInventory(state, id))) {
				event.stop("You're already carrying that.");
				return state;
			}
			event.stop("You can't take that.");
			return state;
		}

		let nextState = state;
		for (const id of fromRoom) {
			nextState = moveObjectFromRoomToInventory(nextState, id);
		}
		for (const { id, containerId } of fromContainer) {
			nextState = moveObjectFromContainerToInventory(nextState, id, containerId);
		}
		return { state: nextState };
	});

	// ── drop ──────────────────────────────────────────────────────────────

	bus.on("drop", (event, state, _world) => {
		const ids = getObjectIds(event.params);
		const toDrop = ids.filter((id) => isInInventory(state, id));
		if (toDrop.length === 0) {
			if (ids.length === 0) {
				event.stop("Drop what?");
				return state;
			}
			event.stop("You're not carrying any of those.");
			return state;
		}
		const roomId = state.player.current_room;
		let nextState = state;
		for (const id of toDrop) {
			nextState = moveObjectFromInventoryToRoom(nextState, id, roomId);
		}
		return { state: nextState };
	});

	// ── open ──────────────────────────────────────────────────────────────

	bus.on("open", (event, state, world) => {
		const target = getTarget(event.params);
		if (!target) {
			event.stop("Open what?");
			return state;
		}
		const obj = world.objects[target];
		const objState = state.objects[target];
		if (!obj || !objState) {
			event.stop("You don't see that here.");
			return state;
		}
		if (obj.type !== "container" && obj.type !== "door") {
			event.stop("You can't open that.");
			return state;
		}
		if (objState.state.locked === true) {
			event.stop("It's locked.");
			return state;
		}
		if (objState.state.open === true) {
			event.stop("It's already open.");
			return state;
		}
		const nextState = setObjectState(state, target, "open", true);

		const contents = (objState?.contains ?? []).map((id) => world.objects[id]?.name).filter(Boolean);
		const name = obj?.name ?? target;
		const feedback =
			contents.length > 0 ? `Opening the ${name} reveals:\n${contents.map((n) => `  ${n}`).join("\n")}` : `Opened.`;

		return { state: nextState, feedback: [feedback] };
	});

	// ── close ─────────────────────────────────────────────────────────────

	bus.on("close", (event, state, world) => {
		const target = getTarget(event.params);
		if (!target) {
			event.stop("Close what?");
			return state;
		}
		const obj = world.objects[target];
		const objState = state.objects[target];
		if (!obj || !objState) {
			event.stop("You don't see that here.");
			return state;
		}
		if (obj.type !== "container" && obj.type !== "door") {
			event.stop("You can't close that.");
			return state;
		}
		if (objState.state.open === false) {
			event.stop("It's already closed.");
			return state;
		}
		return { state: setObjectState(state, target, "open", false) };
	});

	// ── unlock ────────────────────────────────────────────────────────────

	bus.on("unlock", (event, state, world) => {
		const target = getTarget(event.params);
		const instrument = getInstrument(event.params);
		if (!instrument || !isInInventory(state, instrument)) {
			event.stop("You don't have anything to unlock it with.");
			return state;
		}
		const obj = world.objects[target];
		const requiredKey = obj?.requires_instrument?.unlock;
		if (requiredKey && instrument !== requiredKey) {
			event.stop("That doesn't fit the lock.");
			return state;
		}
		return { state: setObjectState(state, target, "locked", false) };
	});

	// ── lock ──────────────────────────────────────────────────────────────

	bus.on("lock", (event, state, _world) => {
		return {
			state: setObjectState(state, getTarget(event.params), "locked", true),
		};
	});

	// ── examine ───────────────────────────────────────────────────────────

	bus.on("examine", (event, state, world) => {
		const targetId = getTarget(event.params);
		if (!targetId) {
			event.stop("Examine what?");
			return state;
		}
		const obj = world.objects[targetId];
		const objState = state.objects[targetId];
		const notHere = !obj || !objState || (!isInRoom(state, targetId) && !isInInventory(state, targetId));
		if (notHere) {
			event.stop("You don't see that here.");
			return state;
		}
		const preposition = event.params.preposition?.trim();
		const description = resolveObjectDescriptionWithPreposition(obj, objState, preposition || undefined);
		const nextState = setObjectState(state, targetId, "examined", true);
		return { state: nextState, feedback: [description] };
	});

	// ── go ────────────────────────────────────────────────────────────────

	bus.on("go", (event, state, world) => {
		const room = world.rooms[state.player.current_room];
		const exit = room?.exits[event.params.direction];
		if (!exit) {
			event.stop("You can't go that way.");
			return state;
		}
		if (exit.condition && !evaluateCondition(exit.condition, state)) {
			event.stop(exit.locked_message ?? "The way is blocked.");
			return state;
		}

		const from = state.player.current_room;
		const to = exit.leads_to;
		let nextState = movePlayer(state, to);
		nextState = ensureVisited(nextState, to);
		const exitResult = executeAction(bus, world, nextState, "exit", {
			room: from,
		});
		nextState = exitResult.state;
		const enterResult = executeAction(bus, world, nextState, "enter", {
			room: to,
		});
		nextState = enterResult.state;
		const lookResult = executeAction(bus, world, nextState, "look", {});
		nextState = lookResult.state;
		const feedback = [...exitResult.feedback, ...enterResult.feedback, ...lookResult.feedback];
		return { state: nextState, feedback };
	});

	// ── tick ──────────────────────────────────────────────────────────────

	bus.on("tick", (_event, state, _world) => {
		const moves = (state.player.state.moves as number) ?? 0;
		return { state: setPlayerState(state, "moves", moves + 1) };
	});

	// ── look ──────────────────────────────────────────────────────────────

	bus.on("look", (_event, state, world) => {
		const roomId = state.player.current_room;
		const room = world.rooms[roomId];
		const roomState = state.rooms[roomId];
		const description = resolveRoomDescription(room, roomState);

		const lines: string[] = [`**${room.name}**`, description];

		for (const id of roomState.contains) {
			const obj = world.objects[id];
			if (!obj) continue;
			const objState = state.objects[id];
			lines.push(`There is a ${obj.name} here.`);
			if (obj.type === "container" && objState?.state.open) {
				const contentNames = (objState.contains ?? []).map((cid) => world.objects[cid]?.name).filter(Boolean);
				if (contentNames.length > 0) {
					lines.push(`The ${obj.name} contains:`);
					for (const name of contentNames) {
						lines.push(`  ${name}`);
					}
				}
			}
		}

		const exits = Object.entries(room.exits)
			.filter(([, exit]) => !exit.condition || evaluateCondition(exit.condition, state))
			.map(([dir]) => dir);
		if (exits.length > 0) {
			lines.push(`Exits: ${exits.join(", ")}.`);
		}

		return { state, feedback: [lines.join("\n")] };
	});

	// ── inventory ─────────────────────────────────────────────────────────

	bus.on("inventory", (event, state, world) => {
		if (state.player.state.dead) {
			event.stop("You have no possessions.");
			return state;
		}
		if (state.player.inventory.length === 0) {
			event.stop("You aren't carrying anything.");
			return state;
		}
		const names = state.player.inventory.map((id) => world.objects[id]?.name ?? id);
		return { state, feedback: [`You are carrying: ${names.join(", ")}.`] };
	});

	// ── help ──────────────────────────────────────────────────────────────

	bus.on("help", (_event, state, _world) => {
		const lines = [
			"Available commands:",
			"  go <direction>     - Move in a direction (n, s, e, w, up, down, ...)",
			"  look (l)           - Look around the current room",
			"  examine <thing> (x)- Look closely at something",
			"  take <thing>       - Pick up an object",
			"  drop <thing>       - Drop an object from inventory",
			"  open <thing>       - Open a container or door",
			"  close <thing>      - Close a container or door",
			"  unlock <thing>     - Unlock something (with key if needed)",
			"  use <thing>        - Use an object, optionally on a target",
			"  talk <person>      - Talk to someone",
			"  inventory (i)      - Check what you're carrying",
			"  help (h)           - Show this list",
			"  quit (q)           - End the game",
		];
		return { state, feedback: [lines.join("\n")] };
	});

	// ── talk ──────────────────────────────────────────────────────────────

	bus.on("talk", (event, state, world) => {
		const target = getTarget(event.params);
		if (!target) {
			event.stop("Talk to whom?");
			return state;
		}
		const obj = world.objects[target];
		if (!obj || (!isInRoom(state, target) && !isInInventory(state, target))) {
			event.stop("You don't see anyone by that name here.");
			return state;
		}
		event.stop(`${obj.name} doesn't seem interested in talking.`);
		return state;
	});

	// ── use ───────────────────────────────────────────────────────────────

	bus.on("use", (event, state, world) => {
		const target = getTarget(event.params);
		if (!target) {
			event.stop("Use what?");
			return state;
		}
		const obj = world.objects[target];
		if (!obj || (!isInRoom(state, target) && !isInInventory(state, target))) {
			event.stop("You don't see that here.");
			return state;
		}
		event.stop(`You can't figure out how to use the ${obj.name}.`);
		return state;
	});

	// ── move ──────────────────────────────────────────────────────────────

	bus.on("move", (event, state, world) => {
		const target = getTarget(event.params);
		if (!target) {
			event.stop("Move what?");
			return state;
		}
		const obj = world.objects[target];
		if (!obj || !isInRoom(state, target)) {
			event.stop("You don't see that here.");
			return state;
		}
		event.stop(`You can't move the ${obj.name}.`);
		return state;
	});

	// ── attack ────────────────────────────────────────────────────────────

	bus.on("attack", (event, state, world) => {
		const target = getTarget(event.params);
		if (!target) {
			event.stop("Attack what?");
			return state;
		}
		const obj = world.objects[target];
		if (!obj || (!isInRoom(state, target) && !isInInventory(state, target))) {
			event.stop("You don't see that here.");
			return state;
		}
		event.stop(`Attacking the ${obj.name} has no effect.`);
		return state;
	});

	// ── quit ──────────────────────────────────────────────────────────────

	bus.on("quit", (_event, state, _world) => {
		return {
			state: setPlayerState(state, "quit", true),
			feedback: ["Goodbye!"],
		};
	});

	bus.on("die", (event, state, _world) => {
		event.stop("You died!");
		return { state: setPlayerState(state, "dead", true) };
	});
}
