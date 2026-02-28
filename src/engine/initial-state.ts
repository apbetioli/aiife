import { type World, WorldSchema } from "../world/types";
import { type GameState, GameStateSchema, type ObjectState } from "./types";

// ─── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Validates that every object is in exactly one place: either in some room.contains,
 * in some container's contains, or in player.inventory.
 */
function validateObjectPlacement(world: World): string[] {
	const errors: string[] = [];
	const placement = new Map<string, string>(); // objId -> "room:roomId" | "container:objId" | "inventory"

	for (const [roomId, room] of Object.entries(world.rooms)) {
		for (const objId of room.contains) {
			if (placement.has(objId)) {
				errors.push(
					`Object "${objId}" is in room "${roomId}" but also in "${placement.get(objId)}"`,
				);
			} else {
				placement.set(objId, `room:${roomId}`);
			}
		}
	}

	for (const [objId, obj] of Object.entries(world.objects)) {
		if (obj.contains) {
			for (const childId of obj.contains) {
				if (placement.has(childId)) {
					errors.push(
						`Object "${childId}" is in container "${objId}" but also in "${placement.get(childId)}"`,
					);
				} else {
					placement.set(childId, `container:${objId}`);
				}
			}
		}
	}

	for (const objId of world.player.inventory) {
		if (placement.has(objId)) {
			errors.push(
				`Object "${objId}" is in player inventory but also in "${placement.get(objId)}"`,
			);
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
 * Validates that room.contains and container contains entries reference valid object ids.
 */
function validateContainment(world: World): string[] {
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

	return errors;
}

/**
 * Validates that player inventory entries reference valid object ids.
 */
function validatePlayerInventory(world: World): string[] {
	const errors: string[] = [];

	for (const objId of world.player.inventory) {
		if (!world.objects[objId]) {
			errors.push(`Player inventory references unknown object "${objId}"`);
		}
	}

	return errors;
}

/**
 * Validates that exit conditions reference objects that actually exist.
 * Condition format: "object_id.state_key == value"
 */
function validateExitConditions(world: World): string[] {
	const errors: string[] = [];
	const conditionPattern = /^(\w+)\.\w+\s*[=!<>]+\s*.+$/;

	for (const [roomId, room] of Object.entries(world.rooms)) {
		for (const [dir, exit] of Object.entries(room.exits)) {
			if (!exit.condition) continue;

			const match = exit.condition.match(conditionPattern);
			if (!match) {
				errors.push(
					`Room "${roomId}" exit "${dir}" has unparseable condition: "${exit.condition}"`,
				);
				continue;
			}

			const referencedObjectId = match[1];
			if (!world.objects[referencedObjectId]) {
				errors.push(
					`Room "${roomId}" exit "${dir}" condition references unknown object "${referencedObjectId}"`,
				);
			}

			if (!world.rooms[exit.leads_to]) {
				errors.push(
					`Room "${roomId}" exit "${dir}" leads_to unknown room "${exit.leads_to}"`,
				);
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
		const issues = worldResult.error.issues
			.map((i) => `  [${i.path.join(".")}] ${i.message}`)
			.join("\n");
		throw new Error(`World schema validation failed:\n${issues}`);
	}

	const locationErrors = validateObjectPlacement(world);
	const containmentErrors = validateContainment(world);
	const inventoryErrors = validatePlayerInventory(world);
	const exitErrors = validateExitConditions(world);

	const allErrors = [
		...locationErrors,
		...containmentErrors,
		...inventoryErrors,
		...exitErrors,
	];

	if (allErrors.length > 0) {
		throw new Error(
			`World integrity validation failed:\n${allErrors.map((e) => `  - ${e}`).join("\n")}`,
		);
	}

	// ── 2. Build room states ───────────────────────────────────────────────
	const rooms: GameState["rooms"] = {};

	for (const [roomId, room] of Object.entries(world.rooms)) {
		rooms[roomId] = {
			visited: (room.state.visited as boolean) ?? false,
			contains: [...room.contains], // copy, never mutate world definition
		};
	}

	// ── 3. Build object states ─────────────────────────────────────────────
	const objects: GameState["objects"] = {};

	for (const [objId, obj] of Object.entries(world.objects)) {
		objects[objId] = {
			// spread authored state flags (locked, open, examined, etc.)
			...obj.state,
			// copy contains list if present (containers)
			...(obj.contains ? { contains: [...obj.contains] } : {}),
		} as ObjectState;
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
		const issues = stateResult.error.issues
			.map((i) => `  [${i.path.join(".")}] ${i.message}`)
			.join("\n");
		throw new Error(`Game state schema validation failed:\n${issues}`);
	}

	return stateResult.data;
}
