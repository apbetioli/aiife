import { type World, WorldSchema } from "../world/types";
import { type GameState, GameStateSchema } from "./types";

// ─── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Validates that every object id in `world.objects` appears in exactly one
 * owner's contains list (room, container, or player inventory).
 * No orphaned or double-owned objects.
 */
export function validateAllObjectsOwned(world: World): string[] {
	const errors: string[] = [];
	const placement = new Map<string, string>(); // objId -> "room:roomId" | "container:objId" | "inventory"

	for (const [roomId, room] of Object.entries(world.rooms)) {
		for (const objId of room.contains) {
			if (placement.has(objId)) {
				errors.push(`Object "${objId}" is in room "${roomId}" but also in "${placement.get(objId)}"`);
			} else {
				placement.set(objId, `room:${roomId}`);
			}
		}
	}

	for (const [objId, obj] of Object.entries(world.objects)) {
		if (obj.contains) {
			for (const childId of obj.contains) {
				if (placement.has(childId)) {
					errors.push(`Object "${childId}" is in container "${objId}" but also in "${placement.get(childId)}"`);
				} else {
					placement.set(childId, `container:${objId}`);
				}
			}
		}
	}

	for (const objId of world.player.inventory) {
		if (placement.has(objId)) {
			errors.push(`Object "${objId}" is in player inventory but also in "${placement.get(objId)}"`);
		} else {
			placement.set(objId, "inventory");
		}
	}

	for (const objId of Object.keys(world.objects)) {
		if (!placement.has(objId)) {
			errors.push(`Object "${objId}" is not in any room, container, or player inventory`);
		}
	}

	return errors;
}

/**
 * Validates that every id in room.contains, object.contains, and player.inventory
 * references a real object in world.objects.
 */
export function validateContainment(world: World): string[] {
	const errors: string[] = [];

	for (const [roomId, room] of Object.entries(world.rooms)) {
		for (const objId of room.contains) {
			if (!world.objects[objId]) {
				errors.push(`Room "${roomId}" contains unknown object "${objId}"`);
			}
		}
	}

	for (const [objId, obj] of Object.entries(world.objects)) {
		if (obj.contains) {
			for (const childId of obj.contains) {
				if (!world.objects[childId]) {
					errors.push(`Object "${objId}" contains unknown object "${childId}"`);
				}
			}
		}
	}

	for (const objId of world.player.inventory) {
		if (!world.objects[objId]) {
			errors.push(`Player inventory references unknown object "${objId}"`);
		}
	}

	return errors;
}

/**
 * Validates that exit conditions reference real object ids and valid target rooms.
 */
export function validateExitConditions(world: World): string[] {
	const errors: string[] = [];
	const conditionPattern = /^(\w+)\.\w+\s*[=!<>]+\s*.+$/;

	for (const [roomId, room] of Object.entries(world.rooms)) {
		for (const [dir, exit] of Object.entries(room.exits)) {
			if (!exit.condition) continue;

			const match = exit.condition.match(conditionPattern);
			if (!match) {
				errors.push(`Room "${roomId}" exit "${dir}" has unparseable condition: "${exit.condition}"`);
				continue;
			}

			const referencedObjectId = match[1];
			if (!world.objects[referencedObjectId]) {
				errors.push(`Room "${roomId}" exit "${dir}" condition references unknown object "${referencedObjectId}"`);
			}

			if (!world.rooms[exit.leads_to]) {
				errors.push(`Room "${roomId}" exit "${dir}" leads_to unknown room "${exit.leads_to}"`);
			}
		}
	}

	return errors;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds the initial mutable game state from a validated world definition.
 *
 * The world definition is static (authored content, descriptions, puzzle design).
 * The game state is mutable (what the engine reads and writes every turn).
 * Keeping them separate makes save/load trivial — just serialize the game state.
 */
export function buildInitialState(world: World): GameState {
	// ── 1. Validate world integrity before building state ──────────────────
	const worldResult = WorldSchema.safeParse(world);
	if (!worldResult.success) {
		const issues = worldResult.error.issues.map((i) => `  [${i.path.join(".")}] ${i.message}`).join("\n");
		throw new Error(`World schema validation failed:\n${issues}`);
	}

	const locationErrors = validateAllObjectsOwned(world);
	const containmentErrors = validateContainment(world);
	const exitErrors = validateExitConditions(world);

	const allErrors = [...locationErrors, ...containmentErrors, ...exitErrors];

	if (allErrors.length > 0) {
		throw new Error(`World integrity validation failed:\n${allErrors.map((e) => `  - ${e}`).join("\n")}`);
	}

	// ── 2. Build room states ───────────────────────────────────────────────
	const rooms: GameState["rooms"] = {};

	for (const [roomId, room] of Object.entries(world.rooms)) {
		rooms[roomId] = {
			contains: [...room.contains],
			state: { visited: false, ...room.state },
		};
	}

	// ── 3. Build object states ─────────────────────────────────────────────
	const objects: GameState["objects"] = {};

	for (const [objId, obj] of Object.entries(world.objects)) {
		objects[objId] = {
			state: { carriable: true, ...obj.state },
			...(obj.contains ? { contains: [...obj.contains] } : {}),
		};
	}

	// ── 4. Build player state ──────────────────────────────────────────────
	const player: GameState["player"] = {
		current_room: world.player.current_room,
		inventory: [...world.player.inventory],
		state: { ...world.player.state },
	};

	// ── 5. Assemble and validate final state ──────────────────────────────
	const gameState: GameState = {
		world_id: world.id,
		version: world.version,
		turn: 0,
		player,
		rooms,
		objects,
	};

	const stateResult = GameStateSchema.safeParse(gameState);
	if (!stateResult.success) {
		const issues = stateResult.error.issues.map((i) => `  [${i.path.join(".")}] ${i.message}`).join("\n");
		throw new Error(`Game state schema validation failed:\n${issues}`);
	}

	return stateResult.data;
}
