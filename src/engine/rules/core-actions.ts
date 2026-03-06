import { z } from "zod";
import type { GameState } from "../types";
import type { World } from "../../world/types";
import { DirectionSchema } from "../../world/types";
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
import { getInstrument, getObjectIds, getTarget } from "./param-helpers";

// ─── Handler context (injected at registration to avoid circular deps) ────────

export interface CoreActionContext {
	bus: unknown;
	executeAction: (
		bus: unknown,
		world: World,
		state: GameState,
		action: string,
		params: Record<string, unknown>,
	) => { state: GameState; feedback: string[] };
}

type StoppableEventLike = {
	params: Record<string, unknown>;
	stop(message?: string | string[]): void;
};

type CoreHandler = (
	event: StoppableEventLike,
	state: GameState,
	world: World,
	ctx: CoreActionContext,
) => { state: GameState; feedback?: string[] } | GameState;

// ─── Shared schemas ─────────────────────────────────────────────────────────

const objectsParams = z.object({ objects: z.array(z.string()) });

// ─── Core action definitions (schema + description + optional handler) ──────

export const coreActionDefinitions = {
	go: {
		schema: z.object({ direction: DirectionSchema }),
		description:
			"go(direction): Go in a direction. direction must be one of: north, south, east, west, northeast, northwest, southeast, southwest, up, down, in, out. Normalize shorthands to full names: n→north, s→south, e→east, w→west, ne→northeast, nw→northwest, se→southeast, sw→southwest, u→up, d→down (in, out have no common shorthand).",
		handler: ((event, state, world, ctx) => {
			const room = world.rooms[state.player.current_room];
			const direction = event.params.direction as string;
			const exit = room?.exits ? (room.exits as Record<string, { leads_to: string; condition?: string; locked_message?: string }>)[direction] : undefined;
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
			const exitResult = ctx.executeAction(ctx.bus as never, world, nextState, "exit", { room: from });
			nextState = exitResult.state;
			const enterResult = ctx.executeAction(ctx.bus as never, world, nextState, "enter", { room: to });
			nextState = enterResult.state;
			const lookResult = ctx.executeAction(ctx.bus as never, world, nextState, "look", {});
			nextState = lookResult.state;
			const feedback = [...exitResult.feedback, ...enterResult.feedback, ...lookResult.feedback];
			return { state: nextState, feedback };
		}) as CoreHandler,
	},
	take: {
		schema: objectsParams,
		description:
			'take(objects): Pick up objects from the current room. For "take all", list every visible carriable object id. For "take X and Y", list [X, Y]. For single "take X", list [X].',
		handler: ((event, state, _world) => {
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
		}) as CoreHandler,
	},
	drop: {
		schema: objectsParams,
		description:
			'drop(objects): Drop objects from inventory. For "drop all", list every inventory object id. For "drop all but X", list every inventory object id except X. For "drop X and Y", list [X, Y]. For single "drop X", list [X].',
		handler: ((event, state, _world) => {
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
		}) as CoreHandler,
	},
	open: {
		schema: objectsParams,
		description:
			"open(objects): Open a container or door. objects: [target_id]. Use only when the player explicitly asks to open (e.g. 'open the box').",
		handler: ((event, state, world) => {
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
		}) as CoreHandler,
	},
	close: {
		schema: objectsParams,
		description: "close(objects): Close a container or door. objects: [target_id].",
		handler: ((event, state, world) => {
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
		}) as CoreHandler,
	},
	unlock: {
		schema: objectsParams,
		description:
			"unlock(objects): Unlock something. objects: [target_id] or [target_id, key_id] if a key is specified.",
		handler: ((event, state, world) => {
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
		}) as CoreHandler,
	},
	lock: {
		schema: objectsParams,
		description: "lock(objects): Lock something. objects: [target_id] or [target_id, key_id] if a key is specified.",
		handler: ((event, state, _world) => ({
			state: setObjectState(state, getTarget(event.params), "locked", true),
		})) as CoreHandler,
	},
	examine: {
		schema: z.object({
			objects: z.array(z.string()),
			preposition: z.string().optional(),
		}),
		description:
			"examine(objects, preposition?): Look closely at an item, actor, or feature. objects: [target_id]. Shorthand: x. Use for 'look at X', 'look under X', 'look behind X', 'look in X', look inside X — add preposition when examining a specific aspect. Omit preposition for plain 'look at' or 'examine'.",
		handler: ((event, state, world) => {
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
			const preposition = (event.params.preposition as string | undefined)?.trim();
			const description = resolveObjectDescriptionWithPreposition(obj, objState, preposition || undefined);
			const nextState = setObjectState(state, targetId, "examined", true);
			return { state: nextState, feedback: [description] };
		}) as CoreHandler,
	},
	use: {
		schema: objectsParams,
		description:
			"use(objects): Use an object, optionally on a target. objects: [item_id] or [item_id, target_id] (e.g. 'use key on door' → [key, door]).",
		handler: ((event, state, world) => {
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
		}) as CoreHandler,
	},
	move: {
		schema: z.object({
			objects: z.array(z.string()),
			direction: z.string().optional(),
		}),
		description: "move(objects, direction?): Move an object. objects: [target_id]. direction is optional.",
		handler: ((event, state, world) => {
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
		}) as CoreHandler,
	},
	attack: {
		schema: objectsParams,
		description: "attack(objects): Attack something. objects: [target_id] or [target_id, weapon_id].",
		handler: ((event, state, world) => {
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
		}) as CoreHandler,
	},
	talk: {
		schema: objectsParams,
		description: "talk(objects): Talk to an actor in the current room. objects: [actor_id].",
		handler: ((event, state, world) => {
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
		}) as CoreHandler,
	},
	enter: { schema: z.object({ room: z.string() }), description: "" },
	exit: { schema: z.object({ room: z.string() }), description: "" },
	look: {
		schema: z.object({}),
		description:
			"look(): Look around the current room. No parameters. Shorthand: l. Use for 'look' with no target; for 'look at <something>' use examine instead.",
		handler: ((_event, state, world) => {
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
		}) as CoreHandler,
	},
	inventory: {
		schema: z.object({}),
		description:
			"inventory(): Check what the player is carrying. No parameters. Shorthand: i. Use for queries like 'what am I carrying?'.",
		handler: ((event, state, world) => {
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
		}) as CoreHandler,
	},
	help: {
		schema: z.object({}),
		description: "help(): Show the list of available commands. No parameters. Shorthand: h.",
		handler: ((_event, state, _world) => {
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
		}) as CoreHandler,
	},
	quit: {
		schema: z.object({}),
		description: "quit(): End the game. Shorthand: q.",
		handler: ((_event, state, _world) => ({
			state: setPlayerState(state, "quit", true),
			feedback: ["Goodbye!"],
		})) as CoreHandler,
	},
	respond: {
		schema: z.object({ message: z.string() }),
		description:
			"respond(message): Reply without changing game state. Use when input is ambiguous or incomplete (e.g. 'take' or 'drop' with no object and multiple options — ask e.g. 'What do you want to take?').",
	},
	tick: {
		schema: z.object({}),
		description: "",
		handler: ((_event, state, _world) => {
			const moves = (state.player.state.moves as number) ?? 0;
			return { state: setPlayerState(state, "moves", moves + 1) };
		}) as CoreHandler,
	},
	"game:start": { schema: z.object({}), description: "" },
	"game:end": { schema: z.object({ victory: z.boolean() }), description: "" },
	die: {
		schema: z.object({}),
		description: "",
		handler: ((event, state, _world) => {
			event.stop("You died!");
			return { state: setPlayerState(state, "dead", true) };
		}) as CoreHandler,
	},
} as const satisfies Record<
	string,
	{ schema: z.ZodType; description: string; handler?: CoreHandler }
>;

// ─── Derived types ───────────────────────────────────────────────────────────

export type CoreEventParamsMap = {
	[K in keyof typeof coreActionDefinitions]: z.infer<(typeof coreActionDefinitions)[K]["schema"]>;
};

export type CoreEventName = keyof CoreEventParamsMap;

// ─── Registration ───────────────────────────────────────────────────────────

type ListenerResult = { state: GameState; feedback?: string[] };

/** Minimal bus shape so we don't import event-bus (avoids circular deps). */
interface BusLike {
	on(
		event: string,
		listener: (event: StoppableEventLike, state: GameState, world: World) => ListenerResult | GameState,
	): void;
}

/** Minimal registry shape so we don't import action-registry. */
interface RegistryLike {
	register(name: string, entry: { schema: z.ZodType; description: string }): void;
}

export function registerCoreActions(bus: BusLike, registry: RegistryLike, ctx: CoreActionContext): void {
	for (const [name, def] of Object.entries(coreActionDefinitions)) {
		registry.register(name, { schema: def.schema, description: def.description });
		if ("handler" in def && def.handler) {
			const handler = def.handler;
			bus.on(name, (e, s, w) => {
				const raw = handler(e, s, w, ctx);
				// Normalize: GameState has "player"; ListenerResult has "state" (+ optional "feedback")
				return "player" in raw ? { state: raw as GameState } : (raw as ListenerResult);
			});
		}
	}
}
