import type { World } from "../world/types";
import { isInInventory, setPlayerState } from "./mutators";
import type { GameState } from "./types";

/**
 * Checks whether an object is currently possessed by the player,
 * either directly in the inventory or inside a carried container.
 */
export function isPossessedByPlayer(state: GameState, objectId: string): boolean {
	const visited = new Set<string>();
	let curr: string | null | undefined = state.objects[objectId]?.location;

	while (curr) {
		if (curr === "inventory") {
			return true;
		}
		if (visited.has(curr)) break;
		visited.add(curr);
		curr = state.objects[curr]?.location;
	}

	return false;
}

/**
 * Checks whether a given location (room or container object ID) is designated as a trophy repository.
 */
export function isTrophyLocation(world: World, state: GameState, locId: string): boolean {
	if (locId === "trophy_room" || locId === "trophy_case") {
		return true;
	}
	const room = world.rooms[locId];
	const roomState = state.rooms[locId];
	if (
		room?.is_trophy === true ||
		room?.state.is_trophy === true ||
		roomState?.state.is_trophy === true ||
		room?.state.trophy_room === true ||
		roomState?.state.trophy_room === true
	) {
		return true;
	}
	const obj = world.objects[locId];
	const objState = state.objects[locId];
	if (
		obj?.is_trophy === true ||
		obj?.state.is_trophy === true ||
		objState?.state.is_trophy === true ||
		obj?.state.trophy_case === true ||
		objState?.state.trophy_case === true
	) {
		return true;
	}
	return false;
}

/**
 * Checks whether an object has been deposited into a trophy room or trophy case container
 * (or nested within containers located in a trophy room/case).
 */
export function isDepositedInTrophy(world: World, state: GameState, objectId: string): boolean {
	const visited = new Set<string>();
	let curr: string | null | undefined = state.objects[objectId]?.location;

	while (curr && curr !== "inventory") {
		if (isTrophyLocation(world, state, curr)) {
			return true;
		}
		if (visited.has(curr)) break;
		visited.add(curr);
		curr = state.objects[curr]?.location;
	}

	return false;
}

/**
 * Deterministically calculates the player's current score based on:
 * 1. Visited rooms with assigned `value`.
 * 2. Treasures/objects with `value` (possessed in inventory or deposited in trophy locations).
 * 3. Treasures/objects with `deposit_value` deposited in trophy locations.
 * 4. Objects with `take_value` taken at least once.
 * 5. Any explicit `score_bonus` on player state.
 */
export function calculateScore(world: World, state: GameState): number {
	let score = 0;

	// 1. Room discovery points
	for (const [roomId, room] of Object.entries(world.rooms)) {
		const roomState = state.rooms[roomId];
		if (!roomState?.state.visited) continue;

		const value =
			room.value ??
			(typeof roomState.state.value === "number" ? (roomState.state.value as number) : undefined) ??
			(typeof room.state.value === "number" ? (room.state.value as number) : undefined);

		if (typeof value === "number") {
			score += value;
		}
	}

	// 2. Object values (treasures)
	for (const [objId, obj] of Object.entries(world.objects)) {
		const objState = state.objects[objId];
		const value =
			obj.value ??
			(typeof objState?.state.value === "number" ? (objState.state.value as number) : undefined) ??
			(typeof obj.state.value === "number" ? (obj.state.value as number) : undefined);

		const depositValue =
			obj.deposit_value ??
			(typeof objState?.state.deposit_value === "number" ? (objState.state.deposit_value as number) : undefined) ??
			(typeof obj.state.deposit_value === "number" ? (obj.state.deposit_value as number) : undefined);

		const takeValue =
			obj.take_value ??
			(typeof objState?.state.take_value === "number" ? (objState.state.take_value as number) : undefined) ??
			(typeof obj.state.take_value === "number" ? (obj.state.take_value as number) : undefined);

		// If takeValue is set and item has been taken at least once
		if (typeof takeValue === "number" && takeValue > 0) {
			if (
				objState?.state.takenOnce === true ||
				isInInventory(state, objId) ||
				isPossessedByPlayer(state, objId) ||
				isDepositedInTrophy(world, state, objId)
			) {
				score += takeValue;
			}
		}

		const possessed = isPossessedByPlayer(state, objId);
		const deposited = isDepositedInTrophy(world, state, objId);

		if (deposited) {
			if (typeof value === "number") {
				score += value;
			}
			if (typeof depositValue === "number") {
				score += depositValue;
			}
		} else if (possessed) {
			if (typeof value === "number") {
				score += value;
			}
		}
	}

	// 3. Score bonus on player state
	if (typeof state.player.state.score_bonus === "number") {
		score += state.player.state.score_bonus;
	}

	return score;
}

/**
 * Calculates the maximum attainable score for a world.
 * Returns `world.max_score` if defined; otherwise calculates the sum of all room and object values.
 */
export function calculateMaxScore(world: World): number {
	if (typeof world.max_score === "number") {
		return world.max_score;
	}

	let maxScore = 0;

	for (const room of Object.values(world.rooms)) {
		const val = room.value ?? (typeof room.state.value === "number" ? (room.state.value as number) : undefined);
		if (typeof val === "number") {
			maxScore += val;
		}
	}

	for (const obj of Object.values(world.objects)) {
		const val =
			obj.value ?? (typeof obj.state.value === "number" ? (obj.state.value as number) : undefined) ?? 0;
		const depVal =
			obj.deposit_value ??
			(typeof obj.state.deposit_value === "number" ? (obj.state.deposit_value as number) : undefined) ??
			0;
		const takeVal =
			obj.take_value ??
			(typeof obj.state.take_value === "number" ? (obj.state.take_value as number) : undefined) ??
			0;
		maxScore += val + depVal + takeVal;
	}

	return maxScore;
}

/**
 * Returns current score and maximum possible score for the game.
 */
export function getScore(world: World, state: GameState): { score: number; maxScore: number } {
	return {
		score: calculateScore(world, state),
		maxScore: calculateMaxScore(world),
	};
}

/**
 * Synchronizes score and max_score into player state.
 */
export function syncScore(world: World, state: GameState): void {
	const { score, maxScore } = getScore(world, state);
	setPlayerState(state, "score", score);
	setPlayerState(state, "max_score", maxScore);
}

/**
 * Adds bonus score points to player state.
 */
export function addScore(state: GameState, points: number): void {
	const currentBonus = typeof state.player.state.score_bonus === "number" ? (state.player.state.score_bonus as number) : 0;
	setPlayerState(state, "score_bonus", currentBonus + points);
}
