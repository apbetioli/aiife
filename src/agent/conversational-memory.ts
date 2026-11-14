import type { ParserContext, ScopedObject } from "../world/types";
import { tryDeterministicIntent } from "./fast-path-parser";
import type { RecognizedIntent } from "./types";

export interface PendingFrame {
	action: string;
	objects: string[];
	preposition?: string | null;
	direction?: string | null;
	waitingFor?: "target" | "instrument" | "disambiguation" | "direction" | "container" | "recipient" | "slot" | string;
	candidates?: string[];
	candidateNoun?: string;
	clarificationPrompt?: string;
	rawInputHistory?: string[];
	[key: string]: unknown;
}

export type SlotResolutionResult =
	| { type: "resolved"; intent: RecognizedIntent }
	| { type: "clarify"; message: string; pendingFrame: PendingFrame }
	| { type: "unresolved" };

const ACTION_VERBS = new Set([
	"take",
	"get",
	"pick",
	"grab",
	"drop",
	"look",
	"examine",
	"read",
	"open",
	"close",
	"unlock",
	"lock",
	"attack",
	"kill",
	"hit",
	"fight",
	"strike",
	"talk",
	"speak",
	"give",
	"put",
	"place",
	"insert",
	"push",
	"pull",
	"turn",
	"light",
	"extinguish",
	"burn",
	"break",
	"smash",
	"cut",
	"tie",
	"untie",
	"throw",
	"blow",
	"drink",
	"eat",
	"wear",
	"remove",
	"enter",
	"exit",
	"board",
	"disembark",
	"climb",
	"jump",
	"go",
	"walk",
	"run",
	"head",
]);

const PREPOSITIONS = ["with", "using", "by", "in", "into", "inside", "on", "onto", "to", "at", "under", "behind"];

/**
 * Checks if input is an explicit cancellation command.
 */
export function isCancellation(input: string): boolean {
	const trimmed = input
		.trim()
		.toLowerCase()
		.replace(/[.!?]+$/, "");
	return /^(?:cancel|nevermind|never mind|stop|abort|forget it|no thanks|nah)$/i.test(trimmed);
}

/**
 * Checks if input is a brand new, unrelated command rather than a slot fragment.
 */
export function isNewCommand(input: string, frame: PendingFrame, _context: ParserContext): boolean {
	const trimmed = input
		.trim()
		.toLowerCase()
		.replace(/[.!?]+$/, "");
	if (!trimmed) return false;

	// Prepositional phrases are never new commands
	const startsWithPrep = PREPOSITIONS.some((p) => trimmed.startsWith(`${p} `));
	if (startsWithPrep) return false;

	// Deterministic fast-path commands (look, inv, wait, quit, etc.)
	const fastIntent = tryDeterministicIntent(trimmed);
	if (fastIntent) {
		// If the pending frame is waiting for direction, direction input is not a new command
		if (fastIntent.action === "go" && frame.waitingFor === "direction") {
			return false;
		}
		return true;
	}

	// Check if input starts with a recognized action verb followed by arguments
	const firstWord = trimmed.split(/\s+/)[0];
	if (ACTION_VERBS.has(firstWord)) {
		return true;
	}

	return false;
}

/**
 * Normalizes user fragment by stripping leading prepositions and articles.
 */
export function cleanNounFragment(raw: string): string {
	let s = raw
		.trim()
		.toLowerCase()
		.replace(/[.!?]+$/, "");
	// Strip leading prepositions
	for (const prep of PREPOSITIONS) {
		const pattern = new RegExp(`^${prep}\\s+`, "i");
		if (pattern.test(s)) {
			s = s.replace(pattern, "");
			break;
		}
	}
	// Strip articles
	s = s.replace(/^(?:the|a|an)\s+/i, "");
	return s.trim();
}

/**
 * Tokenizes a string into clean words, filtering out common stop words.
 */
function tokenize(text: string): string[] {
	const stopWords = new Set(["the", "a", "an", "one", "ones", "of", "in", "with", "please", "my"]);
	return text
		.toLowerCase()
		.split(/[\s_-]+/)
		.filter((w) => w.length > 0 && !stopWords.has(w));
}

/**
 * Matches an input fragment against in-scope candidate objects.
 */
export function matchObjects(fragment: string, objects: ScopedObject[], candidateIds?: string[]): ScopedObject[] {
	const pool = candidateIds ? objects.filter((o) => candidateIds.includes(o.id)) : objects;

	const cleaned = cleanNounFragment(fragment);
	if (!cleaned) return [];

	const userTokens = tokenize(cleaned);

	// 1. Exact ID or name or alias match
	const exactMatches = pool.filter(
		(o) =>
			o.id.toLowerCase() === cleaned ||
			o.name.toLowerCase() === cleaned ||
			o.aliases?.some((a) => a.toLowerCase() === cleaned),
	);
	if (exactMatches.length > 0) return exactMatches;

	// 2. Token subset match: all user tokens appear in the object's name/id/aliases
	const tokenMatches = pool.filter((o) => {
		const objTokens = new Set([...tokenize(o.id), ...tokenize(o.name), ...(o.aliases?.flatMap(tokenize) ?? [])]);
		return userTokens.every((t) => objTokens.has(t));
	});

	if (tokenMatches.length > 0) return tokenMatches;

	// 3. Substring match
	const subMatches = pool.filter(
		(o) =>
			o.name.toLowerCase().includes(cleaned) ||
			o.id.toLowerCase().includes(cleaned) ||
			o.aliases?.some((a) => a.toLowerCase().includes(cleaned)),
	);

	return subMatches;
}

/**
 * Resolves a player fragment into an active PendingFrame.
 */
export function resolveSlotFragment(input: string, frame: PendingFrame, context: ParserContext): SlotResolutionResult {
	const trimmed = input.trim();
	if (!trimmed) return { type: "unresolved" };

	// ── 1. Disambiguation Drill-Down ──────────────────────────────────────────
	if (frame.waitingFor === "disambiguation") {
		const candidates = frame.candidates ?? [];
		const matches = matchObjects(trimmed, context.in_scope_objects, candidates);

		if (matches.length === 1) {
			const resolved = matches[0];
			const newObjects = [...frame.objects];

			if (newObjects.length === 0) {
				newObjects.push(resolved.id);
			} else {
				// We were disambiguating the second / instrument object or target
				newObjects.push(resolved.id);
			}

			// Check if another slot is still needed
			if (frame.action === "attack" && newObjects.length === 1) {
				return {
					type: "clarify",
					message: `Attack ${resolved.name} with what?`,
					pendingFrame: {
						...frame,
						objects: newObjects,
						waitingFor: "instrument",
						clarificationPrompt: `Attack ${resolved.name} with what?`,
					},
				};
			}

			return {
				type: "resolved",
				intent: {
					action: frame.action,
					objects: newObjects,
					preposition: frame.preposition ?? null,
				},
			};
		}

		if (matches.length > 1) {
			return {
				type: "clarify",
				message: `Which ${frame.candidateNoun || "one"}?`,
				pendingFrame: {
					...frame,
					candidates: matches.map((m) => m.id),
					clarificationPrompt: `Which ${frame.candidateNoun || "one"}?`,
				},
			};
		}

		return { type: "unresolved" };
	}

	// ── 2. Waiting for Instrument ─────────────────────────────────────────────
	if (frame.waitingFor === "instrument") {
		const noun = cleanNounFragment(trimmed);
		// Instruments usually reside in inventory, but can be in room
		const inventoryObjects = context.in_scope_objects.filter((o) => o.source === "inventory");
		let matches = matchObjects(noun, inventoryObjects);

		if (matches.length === 0) {
			matches = matchObjects(noun, context.in_scope_objects);
		}

		if (matches.length === 1) {
			const resolved = matches[0];
			const newObjects = [...frame.objects, resolved.id];
			return {
				type: "resolved",
				intent: {
					action: frame.action,
					objects: newObjects,
					preposition: frame.preposition ?? "with",
				},
			};
		}

		if (matches.length > 1) {
			const prompt = `Which ${noun}?`;
			return {
				type: "clarify",
				message: prompt,
				pendingFrame: {
					...frame,
					waitingFor: "disambiguation",
					candidates: matches.map((m) => m.id),
					candidateNoun: noun,
					clarificationPrompt: prompt,
				},
			};
		}

		return { type: "unresolved" };
	}

	// ── 3. Waiting for Target ─────────────────────────────────────────────────
	if (frame.waitingFor === "target") {
		const noun = cleanNounFragment(trimmed);
		const matches = matchObjects(noun, context.in_scope_objects);

		if (matches.length === 1) {
			const resolved = matches[0];
			const newObjects = [resolved.id];

			// If action is attack, check if instrument is also needed
			if (frame.action === "attack") {
				const prompt = `Attack ${resolved.name} with what?`;
				return {
					type: "clarify",
					message: prompt,
					pendingFrame: {
						...frame,
						objects: newObjects,
						waitingFor: "instrument",
						clarificationPrompt: prompt,
					},
				};
			}

			// If action is unlock, check if key is needed
			if (frame.action === "unlock") {
				const prompt = `What do you want to unlock the ${resolved.name} with?`;
				return {
					type: "clarify",
					message: prompt,
					pendingFrame: {
						...frame,
						objects: newObjects,
						waitingFor: "instrument",
						clarificationPrompt: prompt,
					},
				};
			}

			return {
				type: "resolved",
				intent: {
					action: frame.action,
					objects: newObjects,
					preposition: frame.preposition ?? null,
				},
			};
		}

		if (matches.length > 1) {
			const prompt = `Which ${noun}?`;
			return {
				type: "clarify",
				message: prompt,
				pendingFrame: {
					...frame,
					waitingFor: "disambiguation",
					candidates: matches.map((m) => m.id),
					candidateNoun: noun,
					clarificationPrompt: prompt,
				},
			};
		}

		return { type: "unresolved" };
	}

	// ── 4. Waiting for Direction ──────────────────────────────────────────────
	if (frame.waitingFor === "direction") {
		const fastIntent = tryDeterministicIntent(trimmed);
		if (fastIntent?.action === "go" && fastIntent.direction) {
			return {
				type: "resolved",
				intent: {
					action: frame.action,
					direction: fastIntent.direction,
				},
			};
		}
	}

	// ── 5. Waiting for Container or Recipient ─────────────────────────────────
	if (frame.waitingFor === "container" || frame.waitingFor === "recipient") {
		const noun = cleanNounFragment(trimmed);
		const matches = matchObjects(noun, context.in_scope_objects);

		if (matches.length === 1) {
			const resolved = matches[0];
			return {
				type: "resolved",
				intent: {
					action: frame.action,
					objects: [...frame.objects, resolved.id],
					preposition: frame.preposition ?? null,
				},
			};
		}

		if (matches.length > 1) {
			const prompt = `Which ${noun}?`;
			return {
				type: "clarify",
				message: prompt,
				pendingFrame: {
					...frame,
					waitingFor: "disambiguation",
					candidates: matches.map((m) => m.id),
					candidateNoun: noun,
					clarificationPrompt: prompt,
				},
			};
		}
	}

	return { type: "unresolved" };
}

/**
 * Checks if input is an incomplete verb command needing conversational slot clarification.
 */
export function tryVerbFrameIntent(rawInput: string, context: ParserContext): SlotResolutionResult | null {
	const trimmed = rawInput
		.trim()
		.toLowerCase()
		.replace(/[.!?]+$/, "");
	if (!trimmed) return null;

	// "attack" or "attack <target>"
	const attackMatch = trimmed.match(/^(?:attack|hit|kill|strike|fight)(?:\s+(.+))?$/);
	if (attackMatch) {
		const targetFragment = attackMatch[1]?.trim();
		const actors = context.in_scope_objects.filter((o) => o.type === "actor" && o.source === "room");

		if (!targetFragment) {
			if (actors.length === 0) {
				const prompt = "Attack what?";
				return {
					type: "clarify",
					message: prompt,
					pendingFrame: {
						action: "attack",
						objects: [],
						waitingFor: "target",
						clarificationPrompt: prompt,
					},
				};
			}

			if (actors.length === 1) {
				const target = actors[0];
				const prompt = `Attack ${target.name} with what?`;
				return {
					type: "clarify",
					message: prompt,
					pendingFrame: {
						action: "attack",
						objects: [target.id],
						waitingFor: "instrument",
						clarificationPrompt: prompt,
					},
				};
			}

			const prompt = "What do you want to attack?";
			return {
				type: "clarify",
				message: prompt,
				pendingFrame: {
					action: "attack",
					objects: [],
					waitingFor: "target",
					clarificationPrompt: prompt,
				},
			};
		}

		// Target was supplied, check if weapon was supplied with "with"
		const withMatch = targetFragment.match(/^(.+?)\s+with\s+(.+)$/i);
		if (withMatch) {
			// Fully specified: let LLM or engine handle
			return null;
		}

		// Only target was supplied: e.g. "attack troll"
		const targetMatches = matchObjects(targetFragment, actors);
		if (targetMatches.length === 1) {
			const target = targetMatches[0];
			const prompt = `Attack ${target.name} with what?`;
			return {
				type: "clarify",
				message: prompt,
				pendingFrame: {
					action: "attack",
					objects: [target.id],
					waitingFor: "instrument",
					clarificationPrompt: prompt,
				},
			};
		}
	}

	// "take" / "get" / "pick up"
	if (trimmed === "take" || trimmed === "get" || trimmed === "pick up") {
		const prompt = "What do you want to take?";
		return {
			type: "clarify",
			message: prompt,
			pendingFrame: {
				action: "take",
				objects: [],
				waitingFor: "target",
				clarificationPrompt: prompt,
			},
		};
	}

	// "take <noun>" where noun matches multiple objects in room
	const takeMatch = trimmed.match(/^(?:take|get|pick up)\s+(.+)$/);
	if (takeMatch && !trimmed.includes(" all")) {
		const noun = cleanNounFragment(takeMatch[1]);
		const roomItems = context.in_scope_objects.filter((o) => o.source === "room" && o.state?.carriable !== false);
		const matches = matchObjects(noun, roomItems);
		if (matches.length > 1) {
			const prompt = `Which ${noun}?`;
			return {
				type: "clarify",
				message: prompt,
				pendingFrame: {
					action: "take",
					objects: [],
					waitingFor: "disambiguation",
					candidates: matches.map((m) => m.id),
					candidateNoun: noun,
					clarificationPrompt: prompt,
				},
			};
		}
	}

	// "drop" / "put down"
	if (trimmed === "drop" || trimmed === "put down") {
		const prompt = "What do you want to drop?";
		return {
			type: "clarify",
			message: prompt,
			pendingFrame: {
				action: "drop",
				objects: [],
				waitingFor: "target",
				clarificationPrompt: prompt,
			},
		};
	}

	// "unlock"
	if (trimmed === "unlock") {
		const prompt = "What do you want to unlock?";
		return {
			type: "clarify",
			message: prompt,
			pendingFrame: {
				action: "unlock",
				objects: [],
				waitingFor: "target",
				clarificationPrompt: prompt,
			},
		};
	}

	// "unlock <target>" without key
	const unlockMatch = trimmed.match(/^unlock\s+(.+)$/);
	if (unlockMatch) {
		const targetText = cleanNounFragment(unlockMatch[1]);
		if (!targetText.includes(" with ")) {
			const lockables = context.in_scope_objects.filter((o) => o.type === "container" || o.type === "door");
			const matches = matchObjects(targetText, lockables);
			if (matches.length === 1) {
				const prompt = `What do you want to unlock the ${matches[0].name} with?`;
				return {
					type: "clarify",
					message: prompt,
					pendingFrame: {
						action: "unlock",
						objects: [matches[0].id],
						waitingFor: "instrument",
						clarificationPrompt: prompt,
					},
				};
			}
		}
	}

	return null;
}

/**
 * Detects if an assistant output or respond message is asking a clarification question,
 * and extracts the corresponding PendingFrame.
 */
export function detectClarificationFrame(
	message: string,
	context: ParserContext,
	lastIntent?: RecognizedIntent | null,
): PendingFrame | null {
	const trimmed = message.trim();
	if (!trimmed.endsWith("?")) return null;

	// Pattern: "Which <noun>...?"
	const whichMatch = trimmed.match(/^which\s+([a-z0-9_-]+)/i);
	if (whichMatch) {
		const noun = whichMatch[1].toLowerCase();
		const matches = matchObjects(noun, context.in_scope_objects);
		return {
			action: lastIntent?.action ?? "take",
			objects: lastIntent?.objects?.filter(Boolean) ?? [],
			waitingFor: "disambiguation",
			candidates: matches.map((m) => m.id),
			candidateNoun: noun,
			clarificationPrompt: trimmed,
		};
	}

	// Pattern: "(Attack|Hit|Kill) <target> with what?"
	const attackWithMatch = trimmed.match(/^(?:attack|hit|kill)\s+(.+?)\s+with\s+what\??/i);
	if (attackWithMatch) {
		const targetName = attackWithMatch[1].replace(/^(?:the|a|an)\s+/, "");
		const matches = matchObjects(targetName, context.in_scope_objects);
		return {
			action: "attack",
			objects: matches[0] ? [matches[0].id] : [targetName],
			waitingFor: "instrument",
			clarificationPrompt: trimmed,
		};
	}

	// Pattern: "What do you want to unlock (the) <target> with?"
	const unlockWithMatch = trimmed.match(/unlock\s+(?:the\s+)?(.+?)\s+with\s+what\??/i);
	if (unlockWithMatch) {
		const targetName = unlockWithMatch[1].replace(/^(?:the|a|an)\s+/, "");
		const matches = matchObjects(targetName, context.in_scope_objects);
		return {
			action: "unlock",
			objects: matches[0] ? [matches[0].id] : [targetName],
			waitingFor: "instrument",
			clarificationPrompt: trimmed,
		};
	}

	// Pattern: "What do you want to <action>?" or "<Action> what?"
	const whatActionMatch = trimmed.match(/^(?:what\s+do\s+you\s+want\s+to\s+([a-z]+)\??|([a-z]+)\s+what\??)$/i);
	if (whatActionMatch) {
		const act = (whatActionMatch[1] || whatActionMatch[2]).toLowerCase();
		return {
			action: act,
			objects: [],
			waitingFor: "target",
			clarificationPrompt: trimmed,
		};
	}

	return null;
}
