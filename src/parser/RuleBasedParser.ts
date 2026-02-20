import type {
  Direction,
  Parser,
  ParsedAction,
  ParserContext,
} from "../types.js";
import { ACTION_TYPES, DIRECTIONS } from "../types.js";

type ActionConfig = {
  stripPrefix?: RegExp;
  connectors?: string[];
};

const ACTION_CONFIGS: Partial<Record<ParsedAction["actionType"], ActionConfig>> = {
  talk: { stripPrefix: /^(to|with)\s+/i },
  take: { stripPrefix: /^up\s+/i },
  drop: { stripPrefix: /^down\s+/i },
  use:  { connectors: ["on", "with"] },
};

/** Per-verb overrides that adjust how connectors are interpreted. */
const VERB_CONFIG: Partial<Record<string, { flipConnectors?: boolean }>> = {
  unlock: { flipConnectors: true },
};

const DIRECTION_SHORTCUTS: Record<string, Direction> = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  u: "up",
  d: "down",
};

const VERB_MAP: Record<string, ParsedAction["actionType"]> = {
  go: "move",
  walk: "move",
  move: "move",
  run: "move",
  head: "move",
  travel: "move",

  take: "take",
  get: "take",
  grab: "take",
  pick: "take",
  collect: "take",

  drop: "drop",
  put: "drop",
  discard: "drop",
  leave: "drop",

  use: "use",
  apply: "use",
  place: "use",

  examine: "examine",
  x: "examine",
  ex: "examine",
  inspect: "examine",
  study: "examine",
  read: "examine",
  search: "examine",
  check: "examine",

  look: "look",
  l: "look",

  inventory: "inventory",
  i: "inventory",

  talk: "talk",
  speak: "talk",
  ask: "talk",
  chat: "talk",

  open: "open",
  unlock: "use",

  help: "help",

  quit: "quit",
  exit: "quit",
  q: "quit",
};

export class RuleBasedParser implements Parser {
  /**
   * Attempts to parse the input using rules only.
   * Returns null when the input cannot be confidently mapped to an action,
   * signalling that a fallback parser should handle it.
   */
  tryParse(input: string): ParsedAction | null {
    const raw = input.trim();
    const lower = raw.toLowerCase();

    if (DIRECTION_SHORTCUTS[lower]) {
      return {
        actionType: "move",
        direction: DIRECTION_SHORTCUTS[lower],
        rawInput: raw,
      };
    }
    if (DIRECTIONS.includes(lower as Direction)) {
      return {
        actionType: "move",
        direction: lower as Direction,
        rawInput: raw,
      };
    }

    const words = lower.split(/\s+/);
    const verb = words[0];
    const rest = words.slice(1).join(" ");

    const actionType = VERB_MAP[verb];
    if (!actionType) {
      for (const word of words) {
        if (ACTION_TYPES.includes(word as ParsedAction["actionType"])) {
          return this.parseWithAction(
            word as ParsedAction["actionType"],
            words,
            raw
          );
        }
      }
      return null;
    }

    return this.parseWithAction(actionType, words, raw);
  }

  async parseInput(
    input: string,
    _context: ParserContext
  ): Promise<ParsedAction> {
    const raw = input.trim();
    const lower = raw.toLowerCase();
    return (
      this.tryParse(input) ?? {
        actionType: "examine",
        target: lower,
        rawInput: raw,
      }
    );
  }

  private parseWithAction(
    actionType: ParsedAction["actionType"],
    words: string[],
    raw: string
  ): ParsedAction {
    const rest = words.slice(1);

    if (actionType === "move") {
      const dirWord = rest.find(
        (w) =>
          DIRECTIONS.includes(w as Direction) ||
          DIRECTION_SHORTCUTS[w] !== undefined
      );
      const direction = dirWord
        ? DIRECTION_SHORTCUTS[dirWord] ?? (dirWord as Direction)
        : undefined;
      return { actionType: "move", direction, rawInput: raw };
    }

    const config = ACTION_CONFIGS[actionType];
    const verbConfig = VERB_CONFIG[words[0]];
    const joined = rest.join(" ");

    if (config?.connectors) {
      for (const conn of config.connectors) {
        const match = joined.match(
          new RegExp(`^(.+?)\\s+${conn}\\s+(.+)$`, "i")
        );
        if (match) {
          const [a, b] = verbConfig?.flipConnectors
            ? [match[2].trim(), match[1].trim()]
            : [match[1].trim(), match[2].trim()];
          return { actionType, target: a, secondaryTarget: b, rawInput: raw };
        }
      }
      return { actionType, target: joined || undefined, rawInput: raw };
    }

    const stripped = config?.stripPrefix
      ? joined.replace(config.stripPrefix, "").trim()
      : joined.trim();

    return { actionType, target: stripped || undefined, rawInput: raw };
  }
}
