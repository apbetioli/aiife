import { type World, WorldSchema } from "../world/types";
import { type GameState, GameStateSchema } from "./types";

// ─── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Validates that every object in `world.objects` has a valid location
 * (a real room id, a real container object id, or "inventory").
 */
export function validateAllObjectsOwned(world: World): string[] {
	const errors: string[] = [];

	for (const [objId, obj] of Object.entries(world.objects)) {
		const loc = obj.location;

		if (!loc) {
			errors.push(`Object "${objId}" is not in any room, container, or player inventory`);
			continue;
		}

		if (loc === "inventory") {
			continue;
		}

		if (world.rooms[loc]) {
			continue;
		}

		if (world.objects[loc]) {
			if (loc === objId) {
				errors.push(`Object "${objId}" cannot be located inside itself`);
			}
			continue;
		}

		errors.push(`Object "${objId}" is not in any room, container, or player inventory (unknown location: "${loc}")`);
	}

	return errors;
}

/**
 * Validates that container hierarchies contain no cycles.
 */
export function validateContainment(world: World): string[] {
	const errors: string[] = [];

	for (const [objId, obj] of Object.entries(world.objects)) {
		const visited = new Set<string>([objId]);
		let curr = obj.location;

		while (curr && curr !== "inventory" && !world.rooms[curr] && world.objects[curr]) {
			if (visited.has(curr)) {
				errors.push(`Circular containment detected: object "${objId}" is inside a containment cycle`);
				break;
			}
			visited.add(curr);
			curr = world.objects[curr].location;
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
			state: { visited: false, ...room.state },
		};
	}

	// ── 3. Build object states ─────────────────────────────────────────────
	const objects: GameState["objects"] = {};

	for (const [objId, obj] of Object.entries(world.objects)) {
		objects[objId] = {
			location: obj.location,
			state: { carriable: true, ...obj.state },
		};
	}

	// ── 4. Build player state ──────────────────────────────────────────────
	const player: GameState["player"] = {
		current_room: world.player.current_room,
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
