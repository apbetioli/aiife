import {
	type BlockedExit,
	type Direction,
	type Exit,
	type GameObject,
	type ParserContext,
	ParserContextSchema,
	type Room,
	type ScopedObject,
	type World,
} from "../world/types";
import type { GameState, ObjectState, RoomState } from "./types";

// ─── Condition Evaluator ──────────────────────────────────────────────────────

/**
 * Evaluates a simple condition expression against the current game state.
 * Supported format: "object_id.state_key == value"
 *
 * Examples:
 *   "library_door.open == true"
 *   "study_door.locked == false"
 */
export function evaluateCondition(
	condition: string,
	state: GameState,
): boolean {
	// Pattern: objectId.stateKey operator value
	const match = condition.match(/^(\w+)\.(\w+)\s*(==|!=|<=|>=|<|>)\s*(.+)$/);
	if (!match) {
		console.warn(`[evaluateCondition] Unparseable condition: "${condition}"`);
		return false;
	}

	const [, objectId, stateKey, operator, rawValue] = match;

	const objectState = state.objects[objectId];
	if (!objectState) {
		console.warn(
			`[evaluateCondition] Unknown object "${objectId}" in condition: "${condition}"`,
		);
		return false;
	}

	const actual = objectState.flags[stateKey];
	if (actual === undefined) {
		console.warn(
			`[evaluateCondition] Object "${objectId}" has no state key "${stateKey}"`,
		);
		return false;
	}

	// Parse the expected value to the same type as actual
	let expected: boolean | string | number = rawValue.trim();
	if (expected === "true") expected = true;
	else if (expected === "false") expected = false;
	else if (!Number.isNaN(Number(expected))) expected = Number(expected);

	switch (operator) {
		case "==":
			return actual === expected;
		case "!=":
			return actual !== expected;
		case "<":
			return (actual as number) < (expected as number);
		case ">":
			return (actual as number) > (expected as number);
		case "<=":
			return (actual as number) <= (expected as number);
		case ">=":
			return (actual as number) >= (expected as number);
		default:
			return false;
	}
}

// ─── Description Resolver ─────────────────────────────────────────────────────

/**
 * Resolves which description variant to use based on current room state.
 * Falls back to "visited" if the room has been seen, then "default".
 *
 * To add state-driven descriptions, add keys matching state flag names
 * to the room's descriptions map, e.g. { "dark": "You can't see much." }
 */
export function resolveRoomDescription(
	room: Room,
	roomState: RoomState,
): string {
	const flags = roomState.flags;

	// State-driven flags (e.g. dark) take priority over generic "visited"
	for (const [key, value] of Object.entries(flags)) {
		if (key === "visited") continue;
		if (value === true && room.descriptions[key]) {
			return room.descriptions[key];
		}
	}

	// Fall back to visited variant if seen before
	if (flags.visited && room.descriptions.visited) {
		return room.descriptions.visited;
	}

	return room.descriptions.default;
}

/**
 * Resolves which description variant to use based on current object state.
 * First matching true flag with a description key wins, then falls back to "default".
 */
export function resolveObjectDescription(
	obj: GameObject,
	objState: ObjectState,
): string {
	for (const [key, value] of Object.entries(objState.flags)) {
		if (value === true && obj.descriptions[key]) {
			return obj.descriptions[key];
		}
	}

	return obj.descriptions.default;
}

/**
 * Resolves object description with an optional preposition (e.g. behind, under, in).
 * If preposition is given and the object has that description key, returns it.
 * Otherwise falls back to state-driven resolveObjectDescription.
 */
export function resolveObjectDescriptionWithPreposition(
	obj: GameObject,
	objState: ObjectState,
	preposition?: string,
): string {
	const key = preposition?.trim().toLowerCase();
	if (key && obj.descriptions[key]) {
		return obj.descriptions[key];
	}
	return resolveObjectDescription(obj, objState);
}

// ─── Parser Context Builder ───────────────────────────────────────────────────

/**
 * Builds the parser context snapshot sent to the LLM on every turn.
 *
 * This is derived entirely from current game state + world definition.
 * It should be called once per turn, before the LLM inference call.
 *
 * Scope includes:
 *   - Objects physically present in the current room
 *   - Objects in the player's inventory
 *
 * Objects inside closed containers are intentionally excluded from scope —
 * the player can't interact with them until the container is opened.
 */
export function buildParserContext(
	world: World,
	state: GameState,
): ParserContext {
	const currentRoomId = state.player.current_room;
	const room = world.rooms[currentRoomId];
	const roomState = state.rooms[currentRoomId];

	if (!room) {
		throw new Error(`[buildParserContext] Unknown room "${currentRoomId}"`);
	}
	if (!roomState) {
		throw new Error(
			`[buildParserContext] No state found for room "${currentRoomId}"`,
		);
	}

	// ── Resolve exits ──────────────────────────────────────────────────────
	const available_exits: Direction[] = [];
	const blocked_exits: BlockedExit[] = [];

	for (const [dir, exit] of Object.entries(room.exits) as [Direction, Exit][]) {
		const isOpen = !exit.condition || evaluateCondition(exit.condition, state);

		if (isOpen) {
			available_exits.push(dir);
		} else {
			blocked_exits.push({
				direction: dir,
				message: exit.locked_message ?? `The way ${dir} is blocked.`,
			});
		}
	}

	// ── Resolve in-scope objects ───────────────────────────────────────────
	// Scope = room contents + player inventory
	// Objects inside *closed* containers are out of scope
	const in_scope_objects: ScopedObject[] = [];

	for (const objId of roomState.contains) {
		const worldObj = world.objects[objId];
		const objState = state.objects[objId];

		if (!worldObj) {
			console.warn(
				`[buildParserContext] Scoped object "${objId}" not found in world definition`,
			);
			continue;
		}
		if (!objState) {
			console.warn(
				`[buildParserContext] Scoped object "${objId}" has no state entry`,
			);
			continue;
		}

		// State flags only (contains is internal runtime data)
		in_scope_objects.push({
			id: objId,
			name: worldObj.name,
			type: worldObj.type,
			state: objState.flags,
			source: "room",
		});
	}

	for (const objId of state.player.inventory) {
		const worldObj = world.objects[objId];
		const objState = state.objects[objId];

		if (!worldObj) {
			console.warn(
				`[buildParserContext] Scoped object "${objId}" not found in world definition`,
			);
			continue;
		}
		if (!objState) {
			console.warn(
				`[buildParserContext] Scoped object "${objId}" has no state entry`,
			);
			continue;
		}

		in_scope_objects.push({
			id: objId,
			name: worldObj.name,
			type: worldObj.type,
			state: objState.flags,
			source: "inventory",
		});
	}

	// ── Resolve room description ───────────────────────────────────────────
	const description = resolveRoomDescription(room, roomState);

	// ── Assemble and validate ──────────────────────────────────────────────
	const context: ParserContext = {
		room: room.name,
		description,
		available_exits,
		blocked_exits,
		in_scope_objects,
	};

	const result = ParserContextSchema.safeParse(context);
	if (!result.success) {
		throw new Error(
			`[buildParserContext] Context validation failed:\n` +
				result.error.issues
					.map((i) => `  [${i.path.join(".")}] ${i.message}`)
					.join("\n"),
		);
	}

	return result.data;
}
