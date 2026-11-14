export interface ScopedObjectLike {
	name: string;
	aliases?: string[];
}

export interface TutorialHighlightContext {
	objects?: Array<string | ScopedObjectLike>;
	exits?: string[];
	verbs?: string[];
}

export type HighlightFormat = "tags" | "ansi" | "markdown";

export interface HighlightOptions {
	format?: HighlightFormat;
	verbs?: string[];
}

export const DEFAULT_KEY_VERBS: string[] = [
	"turn off",
	"turn on",
	"pick up",
	"get in",
	"get into",
	"get out of",
	"get out",
	"climb into",
	"climb out of",
	"climb out",
	"climb in",
	"look around",
	"look at",
	"take",
	"get",
	"drop",
	"put",
	"place",
	"insert",
	"open",
	"close",
	"shut",
	"unlock",
	"lock",
	"examine",
	"look",
	"read",
	"go",
	"walk",
	"run",
	"head",
	"enter",
	"board",
	"embark",
	"exit",
	"leave",
	"disembark",
	"use",
	"talk",
	"speak",
	"ask",
	"attack",
	"kill",
	"fight",
	"hit",
	"inventory",
	"inv",
	"undo",
	"wait",
	"score",
	"points",
	"save",
	"restore",
	"load",
	"restart",
	"diagnose",
	"help",
	"quit",
	"tutorial",
	"easy",
	"light",
	"extinguish",
	"move",
	"push",
	"pull",
	"climb",
	"break",
	"smash",
	"burn",
	"throw",
	"give",
	"blow",
	"brief",
	"superbrief",
	"verbose",
];

const ESC = String.fromCharCode(27);

function escapeRegExp(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPhraseRegex(phrase: string): RegExp {
	const escaped = escapeRegExp(phrase);
	const prefix = /^\w/.test(phrase) ? "\\b" : "";
	const suffix = /\w$/.test(phrase) ? "\\b" : "";
	return new RegExp(`${prefix}${escaped}${suffix}`, "gi");
}

function formatMatch(text: string, type: "item" | "exit" | "verb", format: HighlightFormat): string {
	switch (format) {
		case "tags":
			return `<${type}>${text}</${type}>`;
		case "ansi":
			switch (type) {
				case "item":
					return `${ESC}[1;36m${text}${ESC}[0m`; // Bold Cyan
				case "exit":
					return `${ESC}[1;32m${text}${ESC}[0m`; // Bold Green
				case "verb":
					return `${ESC}[1;33m${text}${ESC}[0m`; // Bold Yellow
			}
			break;
		case "markdown":
			return `[${type}:${text}]`;
	}
}

interface MatchCandidate {
	phrase: string;
	type: "item" | "exit" | "verb";
	priority: number;
}

interface MatchInterval {
	start: number;
	end: number;
	text: string;
	type: "item" | "exit" | "verb";
	priority: number;
	length: number;
}

function collectRegexMatches(text: string, regex: RegExp): Array<{ start: number; end: number }> {
	const results: Array<{ start: number; end: number }> = [];
	for (const match of text.matchAll(regex)) {
		if (match.index !== undefined) {
			results.push({ start: match.index, end: match.index + match[0].length });
		}
	}
	return results;
}

/**
 * Highlights interactable objects (cyan/item), exits (green/exit), and key verbs (yellow/verb)
 * in room descriptions and game outputs for Tutorial / Easy mode.
 */
export function highlightTutorialText(
	text: string,
	context?: TutorialHighlightContext,
	options?: HighlightOptions,
): string {
	if (!text) return "";

	const format = options?.format ?? "tags";
	const candidates: MatchCandidate[] = [];
	const seenPhrases = new Set<string>();

	const addCandidate = (rawPhrase: string, type: "item" | "exit" | "verb", priority: number) => {
		const phrase = rawPhrase.trim();
		if (!phrase) return;
		const key = `${type}:${phrase.toLowerCase()}`;
		if (seenPhrases.has(key)) return;
		seenPhrases.add(key);
		candidates.push({ phrase, type, priority });
	};

	// 1. In-scope objects (priority 3 = highest)
	if (context?.objects) {
		for (const obj of context.objects) {
			if (typeof obj === "string") {
				addCandidate(obj, "item", 3);
			} else if (obj && typeof obj === "object") {
				if (obj.name) addCandidate(obj.name, "item", 3);
				if (Array.isArray(obj.aliases)) {
					for (const alias of obj.aliases) {
						if (alias) addCandidate(alias, "item", 3);
					}
				}
			}
		}
	}

	// 2. Exits / directions (priority 2)
	if (context?.exits) {
		for (const exit of context.exits) {
			if (typeof exit === "string") {
				addCandidate(exit, "exit", 2);
			}
		}
	}

	// 3. Key verbs (priority 1)
	const combinedVerbs = new Set<string>([...DEFAULT_KEY_VERBS, ...(context?.verbs ?? []), ...(options?.verbs ?? [])]);
	for (const verb of combinedVerbs) {
		if (typeof verb === "string") {
			addCandidate(verb, "verb", 1);
		}
	}

	if (candidates.length === 0) {
		return text;
	}

	// Identify protected ranges (existing tags, highlighted content, or ANSI codes) to prevent nested or corrupt replacements
	const protectedRanges: Array<{ start: number; end: number }> = [
		...collectRegexMatches(text, /<(item|exit|verb)>[\s\S]*?<\/\1>/gi),
		...collectRegexMatches(text, /<[^>]+>/g),
		...collectRegexMatches(text, new RegExp(`${ESC}\\[[0-9;]*m`, "g")),
		...collectRegexMatches(text, /\[(item|exit|verb):[^\]]+\]/g),
	];

	const isProtected = (start: number, end: number): boolean => {
		for (const r of protectedRanges) {
			if (start < r.end && end > r.start) return true;
		}
		return false;
	};

	// Find all match occurrences
	const matches: MatchInterval[] = [];

	for (const candidate of candidates) {
		const regex = buildPhraseRegex(candidate.phrase);
		for (const match of text.matchAll(regex)) {
			if (match.index === undefined) continue;
			const start = match.index;
			const end = start + match[0].length;
			if (!isProtected(start, end)) {
				matches.push({
					start,
					end,
					text: match[0],
					type: candidate.type,
					priority: candidate.priority,
					length: match[0].length,
				});
			}
		}
	}

	if (matches.length === 0) {
		return text;
	}

	// Sort matches:
	// 1. Longer matches first
	// 2. Higher priority first (item > exit > verb)
	// 3. Earlier in text first
	matches.sort((a, b) => {
		if (b.length !== a.length) return b.length - a.length;
		if (b.priority !== a.priority) return b.priority - a.priority;
		return a.start - b.start;
	});

	// Select non-overlapping intervals
	const occupied = new Uint8Array(text.length);
	for (const r of protectedRanges) {
		for (let i = r.start; i < r.end && i < text.length; i++) {
			occupied[i] = 1;
		}
	}

	const selected: MatchInterval[] = [];
	for (const match of matches) {
		let collides = false;
		for (let i = match.start; i < match.end; i++) {
			if (occupied[i]) {
				collides = true;
				break;
			}
		}
		if (!collides) {
			for (let i = match.start; i < match.end; i++) {
				occupied[i] = 1;
			}
			selected.push(match);
		}
	}

	selected.sort((a, b) => a.start - b.start);

	// Construct result
	let result = "";
	let cursor = 0;
	for (const match of selected) {
		result += text.slice(cursor, match.start);
		result += formatMatch(match.text, match.type, format);
		cursor = match.end;
	}
	result += text.slice(cursor);

	return result;
}

/**
 * Strips tutorial tags (<item>, <exit>, <verb>), ANSI escape codes, and markdown tags
 * returning clean plain text.
 */
export function stripHighlight(text: string): string {
	if (!text) return "";
	return text
		.replace(/<\/?(?:item|exit|verb)>/g, "")
		.replace(/\[(?:item|exit|verb):([^\]]+)\]/g, "$1")
		.replace(new RegExp(`${ESC}\\[[0-9;]*m`, "g"), "");
}
