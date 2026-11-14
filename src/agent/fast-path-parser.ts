import type { RecognizedIntent } from "./types";

const DIRECTION_MAP: Record<string, string> = {
	n: "north",
	north: "north",
	s: "south",
	south: "south",
	e: "east",
	east: "east",
	w: "west",
	west: "west",
	ne: "northeast",
	northeast: "northeast",
	nw: "northwest",
	northwest: "northwest",
	se: "southeast",
	southeast: "southeast",
	sw: "southwest",
	southwest: "southwest",
	u: "up",
	up: "up",
	d: "down",
	down: "down",
	in: "in",
	out: "out",
};

/**
 * Splits raw user input into individual commands delimited by periods, semicolons, or newlines.
 * E.g. "DOWN.SOUTH.TAKE DART GUN.WEST.UP" -> ["DOWN", "SOUTH", "TAKE DART GUN", "WEST", "UP"]
 */
export function splitCommands(rawInput: string): string[] {
	if (!rawInput) return [];
	return rawInput
		.split(/[;\n\r.]+/)
		.map((cmd) => cmd.trim())
		.filter((cmd) => cmd.length > 0);
}

/**
 * Fast-path parser for unambiguous zero-entity standard interactive fiction commands.
 * Returns RecognizedIntent if matched deterministically with zero latency and zero LLM tokens.
 * All commands referencing world objects/entities delegate to the LLM intent recognizer.
 */
export function tryDeterministicIntent(rawInput: string): RecognizedIntent | null {
	const trimmed = rawInput.trim().toLowerCase().replace(/\.+$/, "");
	if (!trimmed) return null;

	// Single-word directions
	if (DIRECTION_MAP[trimmed]) {
		return {
			action: "go",
			direction: DIRECTION_MAP[trimmed] as RecognizedIntent["direction"],
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// "go/walk/head/run <dir>"
	const goMatch = trimmed.match(/^(?:go|walk|head|run)\s+([a-z]+)$/);
	if (goMatch && DIRECTION_MAP[goMatch[1]]) {
		return {
			action: "go",
			direction: DIRECTION_MAP[goMatch[1]] as RecognizedIntent["direction"],
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Look
	if (trimmed === "l" || trimmed === "look" || trimmed === "look around") {
		return {
			action: "look",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Inventory
	if (trimmed === "i" || trimmed === "inv" || trimmed === "inventory") {
		return {
			action: "inventory",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Help
	if (trimmed === "h" || trimmed === "help") {
		return {
			action: "help",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Score
	if (trimmed === "score" || trimmed === "points" || trimmed === "sc") {
		return {
			action: "score",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Quit
	if (trimmed === "q" || trimmed === "quit") {
		return {
			action: "quit",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Exit / Disembark / Leave (vehicle)
	if (
		trimmed === "exit" ||
		trimmed === "disembark" ||
		trimmed === "leave" ||
		trimmed === "get out" ||
		trimmed === "climb out"
	) {
		return {
			action: "exit",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	const exitVehicleMatch = trimmed.match(/^(?:exit|leave|disembark|get out of|climb out of)\s+(.+)$/);
	if (exitVehicleMatch) {
		const entity = exitVehicleMatch[1].replace(/^(?:the|a|an)\s+/, "");
		return {
			action: "exit",
			direction: null,
			objects: [entity],
			preposition: null,
			message: null,
		};
	}

	// Enter / Board (vehicle)
	if (
		trimmed === "enter" ||
		trimmed === "board" ||
		trimmed === "embark" ||
		trimmed === "get in" ||
		trimmed === "climb in"
	) {
		return {
			action: "enter",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	const enterVehicleMatch = trimmed.match(/^(?:enter|board|embark|get in|get into|climb into|climb in)\s+(.+)$/);
	if (enterVehicleMatch) {
		const entity = enterVehicleMatch[1].replace(/^(?:the|a|an)\s+/, "");
		return {
			action: "enter",
			direction: null,
			objects: [entity],
			preposition: null,
			message: null,
		};
	}

	// Attack / Kill / Fight / Hit / Strike
	if (trimmed === "attack" || trimmed === "kill" || trimmed === "fight" || trimmed === "hit" || trimmed === "strike") {
		return {
			action: "attack",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	const attackMatch = trimmed.match(/^(?:attack|kill|fight|hit|strike)\s+([^.]+?)(?:\s+(?:with|using)\s+([^.]+?))?$/);
	if (attackMatch) {
		const target = attackMatch[1].replace(/^(?:the|a|an)\s+/, "").trim();
		const instrument = attackMatch[2]?.replace(/^(?:the|a|an)\s+/, "").trim();
		return {
			action: "attack",
			direction: null,
			objects: instrument ? [target, instrument] : [target],
			preposition: instrument ? "with" : null,
			message: null,
		};
	}

	// Unlock
	if (trimmed === "unlock") {
		return {
			action: "unlock",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	const unlockMatch = trimmed.match(/^unlock\s+([^.]+?)(?:\s+(?:with|using)\s+([^.]+?))?$/);
	if (unlockMatch) {
		const target = unlockMatch[1].replace(/^(?:the|a|an)\s+/, "").trim();
		const instrument = unlockMatch[2]?.replace(/^(?:the|a|an)\s+/, "").trim();
		return {
			action: "unlock",
			direction: null,
			objects: instrument ? [target, instrument] : [target],
			preposition: instrument ? "with" : null,
			message: null,
		};
	}

	// Lock
	if (trimmed === "lock") {
		return {
			action: "lock",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	const lockMatch = trimmed.match(/^lock\s+([^.]+?)(?:\s+(?:with|using)\s+([^.]+?))?$/);
	if (lockMatch) {
		const target = lockMatch[1].replace(/^(?:the|a|an)\s+/, "").trim();
		const instrument = lockMatch[2]?.replace(/^(?:the|a|an)\s+/, "").trim();
		return {
			action: "lock",
			direction: null,
			objects: instrument ? [target, instrument] : [target],
			preposition: instrument ? "with" : null,
			message: null,
		};
	}

	// Light / Turn On
	if (trimmed === "light" || trimmed === "turn on" || trimmed === "switch on" || trimmed === "activate") {
		return {
			action: "turn_on",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	const turnOnMatch = trimmed.match(/^(?:turn\s+on|switch\s+on|light|activate)\s+([^.]+?)$/);
	if (turnOnMatch) {
		const entity = turnOnMatch[1].replace(/^(?:the|a|an)\s+/, "").trim();
		return {
			action: "turn_on",
			direction: null,
			objects: [entity],
			preposition: null,
			message: null,
		};
	}

	// Extinguish / Turn Off
	if (trimmed === "turn off" || trimmed === "switch off" || trimmed === "extinguish" || trimmed === "deactivate") {
		return {
			action: "turn_off",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	const turnOffMatch = trimmed.match(/^(?:turn\s+off|switch\s+off|extinguish|deactivate)\s+([^.]+?)$/);
	if (turnOffMatch) {
		const entity = turnOffMatch[1].replace(/^(?:the|a|an)\s+/, "").trim();
		return {
			action: "turn_off",
			direction: null,
			objects: [entity],
			preposition: null,
			message: null,
		};
	}

	// Open (zero-arg)
	if (trimmed === "open") {
		return {
			action: "open",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Close (zero-arg)
	if (trimmed === "close" || trimmed === "shut") {
		return {
			action: "close",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Wait
	if (trimmed === "z" || trimmed === "wait") {
		return {
			action: "wait",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Again
	if (trimmed === "g" || trimmed === "again") {
		return {
			action: "again",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Restart
	if (trimmed === "restart" || trimmed === "restart game") {
		return {
			action: "restart",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Diagnose
	if (trimmed === "diagnose" || trimmed === "health" || trimmed === "status") {
		return {
			action: "diagnose",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Undo
	if (trimmed === "undo") {
		return {
			action: "undo",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Brief
	if (trimmed === "brief") {
		return {
			action: "brief",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Superbrief
	if (trimmed === "superbrief" || trimmed === "super brief" || trimmed === "super-brief") {
		return {
			action: "superbrief",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Verbose
	if (trimmed === "verbose") {
		return {
			action: "verbose",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Die
	if (trimmed === "die" || trimmed === "suicide") {
		return {
			action: "die",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Save
	const saveMatch = trimmed.match(/^save(?:\s+([a-zA-Z0-9_-]+))?$/);
	if (saveMatch) {
		return {
			action: "save",
			slot: saveMatch[1] ?? "default",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	// Restore / Load
	const restoreMatch = trimmed.match(/^(?:restore|load)(?:\s+([a-zA-Z0-9_-]+))?$/);
	if (restoreMatch) {
		return {
			action: "restore",
			slot: restoreMatch[1] ?? "default",
			direction: null,
			objects: null,
			preposition: null,
			message: null,
		};
	}

	return null;
}
