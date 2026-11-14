import {
	findOpenContainerInRoom,
	getPlayerVehicle,
	isInInventory,
	isInRoom,
	isInScope,
	isVehicle,
} from "../engine/mutators";
import type { GameState } from "../engine/types";
import type { World } from "../world/types";
import type { RecognizedIntent } from "./types";

export interface AssumptionDetail {
	slot: "target" | "instrument";
	objectId: string;
	objectName: string;
}

export interface AssumptionResolution {
	intent: RecognizedIntent;
	assumptions: AssumptionDetail[];
	announcement: string | null;
}

/**
 * Resolves a noun, ID, or alias to a canonical object ID in the world.
 */
export function resolveEntityId(
	nameOrId: string,
	world: World,
	state: GameState,
	inScopeOnly = false,
): string | undefined {
	if (!nameOrId) return undefined;
	const trimmed = nameOrId.trim();
	if (!trimmed) return undefined;

	// Exact ID match
	if (world.objects[trimmed]) {
		if (!inScopeOnly || isInScope(state, trimmed)) {
			return trimmed;
		}
	}

	const lower = trimmed.toLowerCase();

	// Check scope first
	for (const [id, obj] of Object.entries(world.objects)) {
		if (isInScope(state, id)) {
			if (
				id.toLowerCase() === lower ||
				obj.name?.toLowerCase() === lower ||
				obj.aliases?.some((a) => a.toLowerCase() === lower)
			) {
				return id;
			}
		}
	}

	if (inScopeOnly) return undefined;

	// Check all world objects
	for (const [id, obj] of Object.entries(world.objects)) {
		if (
			id.toLowerCase() === lower ||
			obj.name?.toLowerCase() === lower ||
			obj.aliases?.some((a) => a.toLowerCase() === lower)
		) {
			return id;
		}
	}

	return undefined;
}

function withArticle(name: string): string {
	const trimmed = name.trim();
	if (/^(?:the|a|an)\s+/i.test(trimmed)) {
		return trimmed;
	}
	return `the ${trimmed}`;
}

export function formatAssumptionAnnouncement(assumptions: AssumptionDetail[]): string | null {
	if (assumptions.length === 0) return null;

	const target = assumptions.find((a) => a.slot === "target");
	const instrument = assumptions.find((a) => a.slot === "instrument");

	if (target && instrument) {
		return `(${withArticle(target.objectName)} with ${withArticle(instrument.objectName)})`;
	}
	if (instrument) {
		return `(with ${withArticle(instrument.objectName)})`;
	}
	if (target) {
		return `(${withArticle(target.objectName)})`;
	}
	return null;
}

const ACTION_CANONICAL_MAP: Record<string, string> = {
	attack: "attack",
	hit: "attack",
	strike: "attack",
	fight: "attack",
	kill: "attack",

	unlock: "unlock",
	lock: "lock",

	turn_on: "turn_on",
	"turn on": "turn_on",
	light: "turn_on",
	"switch on": "turn_on",
	activate: "turn_on",

	turn_off: "turn_off",
	"turn off": "turn_off",
	extinguish: "turn_off",
	"switch off": "turn_off",
	deactivate: "turn_off",

	open: "open",
	close: "close",
	shut: "close",

	enter: "enter",
	board: "enter",
	embark: "enter",
	"get in": "enter",
	"climb in": "enter",

	exit: "exit",
	leave: "exit",
	disembark: "exit",
	"get out": "exit",
	"climb out": "exit",
};

/**
 * Resolves verb frame assumption defaults for actions missing required parameters.
 * When unambiguous candidates exist in room scope or inventory:
 * - Populates the missing slot(s) in intent.objects
 * - Generates standard IF assumption announcement, e.g. "(with the elvish sword)"
 */
export function resolveVerbFrameAssumptions(
	intent: RecognizedIntent,
	world: World,
	state: GameState,
): AssumptionResolution {
	const canonicalAction = ACTION_CANONICAL_MAP[intent.action.toLowerCase()] ?? intent.action;

	const resolvedIntent: RecognizedIntent = {
		...intent,
		objects: intent.objects ? [...intent.objects] : undefined,
	};

	const assumptions: AssumptionDetail[] = [];

	// Resolve any existing passed object references to canonical IDs
	if (resolvedIntent.objects && resolvedIntent.objects.length > 0) {
		resolvedIntent.objects = resolvedIntent.objects.map((objRef) => {
			if (typeof objRef === "string" && objRef.trim()) {
				const id = resolveEntityId(objRef, world, state);
				return id ?? objRef;
			}
			return objRef;
		});
	}

	const rawTarget = resolvedIntent.objects?.[0]?.trim();
	const rawInstrument = resolvedIntent.objects?.[1]?.trim();

	const hasTarget = Boolean(rawTarget);
	const hasInstrument = Boolean(rawInstrument);

	switch (canonicalAction) {
		case "attack": {
			let targetId = hasTarget ? rawTarget : undefined;

			// Slot 0: Target (villain / enemy / actor in current room)
			if (!targetId) {
				const actorCandidates = Object.keys(world.objects).filter((id) => {
					if (id === "player") return false;
					const obj = world.objects[id];
					const objState = state.objects[id];
					if (!obj || !objState) return false;

					// Must be in current room
					const inRoom = isInRoom(state, id) || Boolean(findOpenContainerInRoom(state, id));
					if (!inRoom) return false;

					// Must be actor/enemy
					const isActor = obj.type === "actor" || obj.type === "enemy" || obj.state?.alive !== undefined;
					if (!isActor) return false;

					// Must not be dead
					if (objState.state.dead === true || objState.state.alive === false) {
						return false;
					}

					return true;
				});

				if (actorCandidates.length === 1) {
					targetId = actorCandidates[0];
					const targetObj = world.objects[targetId];
					assumptions.push({
						slot: "target",
						objectId: targetId,
						objectName: targetObj?.name ?? targetId,
					});
				}
			}

			// Slot 1: Instrument (weapon in inventory)
			let instrumentId = hasInstrument ? rawInstrument : undefined;
			if (!instrumentId) {
				const weaponCandidates = Object.keys(world.objects).filter((id) => {
					const obj = world.objects[id];
					if (!obj) return false;
					if (!isInInventory(state, id)) return false;

					const isWeapon =
						obj.type === "weapon" ||
						["sword", "knife", "dagger", "axe", "gun", "blade", "club"].some(
							(w) => id.toLowerCase().includes(w) || obj.name.toLowerCase().includes(w),
						);
					return isWeapon;
				});

				if (weaponCandidates.length === 1) {
					instrumentId = weaponCandidates[0];
					const instrumentObj = world.objects[instrumentId];
					assumptions.push({
						slot: "instrument",
						objectId: instrumentId,
						objectName: instrumentObj?.name ?? instrumentId,
					});
				}
			}

			if (targetId || instrumentId) {
				resolvedIntent.objects = [targetId ?? "", ...(instrumentId ? [instrumentId] : [])].filter(
					(v, idx) => v !== "" || idx === 0,
				);
				// If targetId was empty string but instrument exists, keep empty target so positional index 1 is instrument
				if (!targetId && instrumentId) {
					resolvedIntent.objects = ["", instrumentId];
				}
			}
			break;
		}

		case "unlock": {
			let targetId = hasTarget ? rawTarget : undefined;

			// Slot 0: Target (locked container or door in room/scope)
			if (!targetId) {
				const lockedCandidates = Object.keys(world.objects).filter((id) => {
					const obj = world.objects[id];
					const objState = state.objects[id];
					if (!obj || !objState) return false;
					if (!isInScope(state, id)) return false;

					const isLockable = obj.type === "door" || obj.type === "container" || objState.state.locked !== undefined;
					return isLockable && objState.state.locked === true;
				});

				if (lockedCandidates.length === 1) {
					targetId = lockedCandidates[0];
					const targetObj = world.objects[targetId];
					assumptions.push({
						slot: "target",
						objectId: targetId,
						objectName: targetObj?.name ?? targetId,
					});
				}
			}

			// Slot 1: Instrument (key in inventory)
			let instrumentId = hasInstrument ? rawInstrument : undefined;
			if (!instrumentId) {
				// If target is known, check for required key first
				const targetObj = targetId ? world.objects[targetId] : undefined;
				const requiredKey = targetObj?.requires_instrument?.unlock;

				if (requiredKey && isInInventory(state, requiredKey)) {
					instrumentId = requiredKey;
					const keyObj = world.objects[instrumentId];
					assumptions.push({
						slot: "instrument",
						objectId: instrumentId,
						objectName: keyObj?.name ?? instrumentId,
					});
				} else {
					// Search for keys in inventory
					const keyCandidates = Object.keys(world.objects).filter((id) => {
						const obj = world.objects[id];
						if (!obj) return false;
						if (!isInInventory(state, id)) return false;
						return obj.type === "key" || id.toLowerCase().includes("key") || obj.name.toLowerCase().includes("key");
					});

					if (keyCandidates.length === 1) {
						instrumentId = keyCandidates[0];
						const keyObj = world.objects[instrumentId];
						assumptions.push({
							slot: "instrument",
							objectId: instrumentId,
							objectName: keyObj?.name ?? instrumentId,
						});
					}
				}
			}

			if (targetId || instrumentId) {
				if (targetId && instrumentId) {
					resolvedIntent.objects = [targetId, instrumentId];
				} else if (targetId) {
					resolvedIntent.objects = [targetId];
				} else if (instrumentId) {
					resolvedIntent.objects = ["", instrumentId];
				}
			}
			break;
		}

		case "lock": {
			let targetId = hasTarget ? rawTarget : undefined;

			// Slot 0: Target (unlocked container or door in room/scope)
			if (!targetId) {
				const unlockableCandidates = Object.keys(world.objects).filter((id) => {
					const obj = world.objects[id];
					const objState = state.objects[id];
					if (!obj || !objState) return false;
					if (!isInScope(state, id)) return false;

					const isLockable = obj.type === "door" || obj.type === "container" || objState.state.locked !== undefined;
					return isLockable && objState.state.locked === false;
				});

				if (unlockableCandidates.length === 1) {
					targetId = unlockableCandidates[0];
					const targetObj = world.objects[targetId];
					assumptions.push({
						slot: "target",
						objectId: targetId,
						objectName: targetObj?.name ?? targetId,
					});
				}
			}

			// Slot 1: Instrument (key in inventory)
			let instrumentId = hasInstrument ? rawInstrument : undefined;
			if (!instrumentId) {
				const targetObj = targetId ? world.objects[targetId] : undefined;
				const requiredKey = targetObj?.requires_instrument?.lock ?? targetObj?.requires_instrument?.unlock;

				if (requiredKey && isInInventory(state, requiredKey)) {
					instrumentId = requiredKey;
					const keyObj = world.objects[instrumentId];
					assumptions.push({
						slot: "instrument",
						objectId: instrumentId,
						objectName: keyObj?.name ?? instrumentId,
					});
				} else {
					const keyCandidates = Object.keys(world.objects).filter((id) => {
						const obj = world.objects[id];
						if (!obj) return false;
						if (!isInInventory(state, id)) return false;
						return obj.type === "key" || id.toLowerCase().includes("key") || obj.name.toLowerCase().includes("key");
					});

					if (keyCandidates.length === 1) {
						instrumentId = keyCandidates[0];
						const keyObj = world.objects[instrumentId];
						assumptions.push({
							slot: "instrument",
							objectId: instrumentId,
							objectName: keyObj?.name ?? instrumentId,
						});
					}
				}
			}

			if (targetId || instrumentId) {
				if (targetId && instrumentId) {
					resolvedIntent.objects = [targetId, instrumentId];
				} else if (targetId) {
					resolvedIntent.objects = [targetId];
				} else if (instrumentId) {
					resolvedIntent.objects = ["", instrumentId];
				}
			}
			break;
		}

		case "turn_on": {
			let targetId = hasTarget ? rawTarget : undefined;

			// Slot 0: Light source in inventory or current room (currently off)
			if (!targetId) {
				const isLightSource = (id: string) => {
					const obj = world.objects[id];
					const objState = state.objects[id];
					if (!obj || !objState) return false;
					if (objState.state.lit === true) return false;

					return (
						objState.state.lit !== undefined ||
						["lantern", "lamp", "candle", "torch", "match"].some(
							(k) => id.toLowerCase().includes(k) || obj.name.toLowerCase().includes(k),
						)
					);
				};

				// Prefer inventory light sources first
				const invCandidates = Object.keys(world.objects).filter((id) => isInInventory(state, id) && isLightSource(id));

				if (invCandidates.length === 1) {
					targetId = invCandidates[0];
				} else if (invCandidates.length === 0) {
					const roomCandidates = Object.keys(world.objects).filter((id) => isInScope(state, id) && isLightSource(id));
					if (roomCandidates.length === 1) {
						targetId = roomCandidates[0];
					}
				}

				if (targetId) {
					const targetObj = world.objects[targetId];
					assumptions.push({
						slot: "target",
						objectId: targetId,
						objectName: targetObj?.name ?? targetId,
					});
					resolvedIntent.objects = [targetId];
				}
			}
			break;
		}

		case "turn_off": {
			let targetId = hasTarget ? rawTarget : undefined;

			// Slot 0: Light source in inventory or room (currently on)
			if (!targetId) {
				const isLitLightSource = (id: string) => {
					const obj = world.objects[id];
					const objState = state.objects[id];
					if (!obj || !objState) return false;
					return (
						objState.state.lit === true ||
						(["lantern", "lamp", "candle", "torch"].some(
							(k) => id.toLowerCase().includes(k) || obj.name.toLowerCase().includes(k),
						) &&
							objState.state.lit !== false)
					);
				};

				const invCandidates = Object.keys(world.objects).filter(
					(id) => isInInventory(state, id) && isLitLightSource(id),
				);

				if (invCandidates.length === 1) {
					targetId = invCandidates[0];
				} else if (invCandidates.length === 0) {
					const roomCandidates = Object.keys(world.objects).filter(
						(id) => isInScope(state, id) && isLitLightSource(id),
					);
					if (roomCandidates.length === 1) {
						targetId = roomCandidates[0];
					}
				}

				if (targetId) {
					const targetObj = world.objects[targetId];
					assumptions.push({
						slot: "target",
						objectId: targetId,
						objectName: targetObj?.name ?? targetId,
					});
					resolvedIntent.objects = [targetId];
				}
			}
			break;
		}

		case "open": {
			let targetId = hasTarget ? rawTarget : undefined;

			if (!targetId) {
				const openableCandidates = Object.keys(world.objects).filter((id) => {
					const obj = world.objects[id];
					const objState = state.objects[id];
					if (!obj || !objState) return false;
					if (!isInScope(state, id)) return false;

					const isOpenable = obj.type === "door" || obj.type === "container" || objState.state.open !== undefined;
					return isOpenable && objState.state.open === false;
				});

				if (openableCandidates.length === 1) {
					targetId = openableCandidates[0];
					const targetObj = world.objects[targetId];
					assumptions.push({
						slot: "target",
						objectId: targetId,
						objectName: targetObj?.name ?? targetId,
					});
					resolvedIntent.objects = [targetId];
				}
			}
			break;
		}

		case "close": {
			let targetId = hasTarget ? rawTarget : undefined;

			if (!targetId) {
				const closeableCandidates = Object.keys(world.objects).filter((id) => {
					const obj = world.objects[id];
					const objState = state.objects[id];
					if (!obj || !objState) return false;
					if (!isInScope(state, id)) return false;

					const isOpenable = obj.type === "door" || obj.type === "container" || objState.state.open !== undefined;
					return isOpenable && objState.state.open === true;
				});

				if (closeableCandidates.length === 1) {
					targetId = closeableCandidates[0];
					const targetObj = world.objects[targetId];
					assumptions.push({
						slot: "target",
						objectId: targetId,
						objectName: targetObj?.name ?? targetId,
					});
					resolvedIntent.objects = [targetId];
				}
			}
			break;
		}

		case "enter": {
			let targetId = hasTarget ? rawTarget : undefined;

			if (!targetId) {
				const currentVehicle = getPlayerVehicle(state);
				if (!currentVehicle) {
					const vehicleCandidates = Object.keys(world.objects).filter((id) => {
						const obj = world.objects[id];
						const objState = state.objects[id];
						return objState?.location === state.player.current_room && isVehicle(obj, objState);
					});

					if (vehicleCandidates.length === 1) {
						targetId = vehicleCandidates[0];
						const targetObj = world.objects[targetId];
						assumptions.push({
							slot: "target",
							objectId: targetId,
							objectName: targetObj?.name ?? targetId,
						});
						resolvedIntent.objects = [targetId];
					}
				}
			}
			break;
		}

		case "exit": {
			let targetId = hasTarget ? rawTarget : undefined;

			if (!targetId) {
				const currentVehicle = getPlayerVehicle(state);
				if (currentVehicle) {
					targetId = currentVehicle;
					const targetObj = world.objects[targetId];
					assumptions.push({
						slot: "target",
						objectId: targetId,
						objectName: targetObj?.name ?? targetId,
					});
					resolvedIntent.objects = [targetId];
				}
			}
			break;
		}

		default:
			break;
	}

	const announcement = formatAssumptionAnnouncement(assumptions);

	return {
		intent: resolvedIntent,
		assumptions,
		announcement,
	};
}
