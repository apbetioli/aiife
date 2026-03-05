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
import {
	evaluateCondition,
	resolveObjectDescriptionWithPreposition,
	resolveRoomDescription,
} from "../parser-context";
import type { ActionRegistry } from "./action-registry";
import type { EventBus } from "./event-bus";
import { executeAction } from "./executor";
import { getInstrument, getObjectIds, getTarget } from "./param-helpers";

export function registerCoreHandlers(
	bus: EventBus,
	registry: ActionRegistry,
): void {
	// ── take ──────────────────────────────────────────────────────────────

	bus.on("take", (event, state, _world) => {
		const ids = getObjectIds(event.params);
		if (ids.length === 0) return { state, cancel: "Take what?" };

		const canTake = (id: string) =>
			state.objects[id]?.flags.carriable !== false && !isInInventory(state, id);

		const fromRoom = ids.filter((id) => isInRoom(state, id) && canTake(id));
		const fromContainer: { id: string; containerId: string }[] = [];
		for (const id of ids) {
			if (fromRoom.includes(id)) continue;
			if (!canTake(id)) continue;
			const cid = findOpenContainerInRoom(state, id);
			if (cid) fromContainer.push({ id, containerId: cid });
		}

		if (fromRoom.length === 0 && fromContainer.length === 0) {
			if (ids.some((id) => isInInventory(state, id)))
				return { state, cancel: "You're already carrying that." };
			return { state, cancel: "You can't take that." };
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
			if (ids.length === 0) return { state, cancel: "Drop what?" };
			return { state, cancel: "You're not carrying any of those." };
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
		const objState = state.objects[target];
		if (objState?.flags.locked === true)
			return { state, cancel: "It's locked." };
		if (objState?.flags.open === true)
			return { state, cancel: "It's already open." };
		const nextState = setObjectState(state, target, "open", true);

		const obj = world.objects[target];
		const contents = (objState?.contains ?? [])
			.map((id) => world.objects[id]?.name)
			.filter(Boolean);
		const name = obj?.name ?? target;
		const feedback =
			contents.length > 0
				? `Opening the ${name} reveals:\n${contents.map((n) => `  ${n}`).join("\n")}`
				: `Opened.`;

		return { state: nextState, feedback: [feedback] };
	});

	// ── close ─────────────────────────────────────────────────────────────

	bus.on("close", (event, state, _world) => {
		const target = getTarget(event.params);
		const objState = state.objects[target];
		if (objState?.flags.open === false)
			return { state, cancel: "It's already closed." };
		return { state: setObjectState(state, target, "open", false) };
	});

	// ── unlock ────────────────────────────────────────────────────────────

	bus.on("unlock", (event, state, world) => {
		const target = getTarget(event.params);
		const instrument = getInstrument(event.params);
		if (!instrument || !isInInventory(state, instrument))
			return { state, cancel: "You don't have anything to unlock it with." };
		const obj = world.objects[target];
		const requiredKey = obj?.requires_instrument?.unlock;
		if (requiredKey && instrument !== requiredKey)
			return { state, cancel: "That doesn't fit the lock." };
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
			return { state, cancel: "Examine what?" };
		}
		const obj = world.objects[targetId];
		const objState = state.objects[targetId];
		const notHere =
			!obj ||
			!objState ||
			(!isInRoom(state, targetId) && !isInInventory(state, targetId));
		if (notHere) {
			return { state, cancel: "You don't see that here." };
		}
		const preposition = event.params.preposition?.trim();
		const description = resolveObjectDescriptionWithPreposition(
			obj,
			objState,
			preposition || undefined,
		);
		const nextState = setObjectState(state, targetId, "examined", true);
		return { state: nextState, feedback: [description] };
	});

	// ── go ────────────────────────────────────────────────────────────────

	bus.on("go", (event, state, world) => {
		const room = world.rooms[state.player.current_room];
		const exit = room?.exits[event.params.direction];
		if (!exit) return { state, cancel: "You can't go that way." };
		if (exit.condition && !evaluateCondition(exit.condition, state))
			return { state, cancel: exit.locked_message ?? "The way is blocked." };

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
		const feedback = [
			...exitResult.feedback,
			...enterResult.feedback,
			...lookResult.feedback,
		];
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
			if (obj.type === "container" && objState?.flags.open) {
				const contentNames = (objState.contains ?? [])
					.map((cid) => world.objects[cid]?.name)
					.filter(Boolean);
				if (contentNames.length > 0) {
					lines.push(`The ${obj.name} contains:`);
					for (const name of contentNames) {
						lines.push(`  ${name}`);
					}
				}
			}
		}

		const exits = Object.entries(room.exits)
			.filter(
				([, exit]) =>
					!exit.condition || evaluateCondition(exit.condition, state),
			)
			.map(([dir]) => dir);
		if (exits.length > 0) {
			lines.push(`Exits: ${exits.join(", ")}.`);
		}

		return { state, feedback: [lines.join("\n")] };
	});

	// ── inventory ─────────────────────────────────────────────────────────

	bus.on("inventory", (_event, state, world) => {
		if (state.player.inventory.length === 0) {
			return { state, feedback: ["You aren't carrying anything."] };
		}
		const names = state.player.inventory.map(
			(id) => world.objects[id]?.name ?? id,
		);
		return { state, feedback: [`You are carrying: ${names.join(", ")}.`] };
	});

	// ── help ──────────────────────────────────────────────────────────────

	bus.on("help", (_event, state, _world) => {
		const descriptions = registry.getDescriptions();
		const lines = Object.values(descriptions).map((d) => `- ${d}`);
		return { state, feedback: ["Available commands:", ...lines] };
	});

	// ── quit ──────────────────────────────────────────────────────────────

	bus.on("quit", (_event, state, _world) => {
		return {
			state: setPlayerState(state, "quit", true),
			feedback: ["Goodbye!"],
		};
	});
}
