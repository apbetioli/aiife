import type {
  Direction,
  Parser,
  ParsedAction,
  ParserContext,
} from "../types.js";
import { ACTION_TYPES, DIRECTIONS } from "../types.js";

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
  inspect: "examine",
  study: "examine",
  read: "examine",
  search: "examine",
  check: "examine",

  look: "look",

  inventory: "inventory",

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

    if (lower === "l") {
      return { actionType: "look", rawInput: raw };
    }
    if (lower === "i") {
      return { actionType: "inventory", rawInput: raw };
    }
    if (lower === "x" || lower === "ex") {
      return { actionType: "examine", rawInput: raw };
    }

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

    if (verb === "x") {
      return {
        actionType: "examine",
        target: rest || undefined,
        rawInput: raw,
      };
    }

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

    if (actionType === "talk") {
      const stripped = rest
        .join(" ")
        .replace(/^(to|with)\s+/i, "")
        .trim();
      return {
        actionType: "talk",
        target: stripped || undefined,
        rawInput: raw,
      };
    }

    if (actionType === "use") {
      const joined = rest.join(" ");

      if (words[0] === "unlock") {
        const withMatch = joined.match(/^(.+?)\s+with\s+(.+)$/i);
        if (withMatch) {
          return {
            actionType: "use",
            target: withMatch[2].trim(),
            secondaryTarget: withMatch[1].trim(),
            rawInput: raw,
          };
        }
        return {
          actionType: "use",
          target: joined || undefined,
          rawInput: raw,
        };
      }

      const onMatch = joined.match(/^(.+?)\s+on\s+(.+)$/i);
      if (onMatch) {
        return {
          actionType: "use",
          target: onMatch[1].trim(),
          secondaryTarget: onMatch[2].trim(),
          rawInput: raw,
        };
      }

      const withMatch = joined.match(/^(.+?)\s+with\s+(.+)$/i);
      if (withMatch) {
        return {
          actionType: "use",
          target: withMatch[1].trim(),
          secondaryTarget: withMatch[2].trim(),
          rawInput: raw,
        };
      }

      return { actionType: "use", target: joined || undefined, rawInput: raw };
    }

    if (actionType === "take") {
      const joined = rest
        .join(" ")
        .replace(/^up\s+/i, "")
        .trim();
      return { actionType: "take", target: joined || undefined, rawInput: raw };
    }

    if (actionType === "drop") {
      const joined = rest
        .join(" ")
        .replace(/^down\s+/i, "")
        .trim();
      return { actionType: "drop", target: joined || undefined, rawInput: raw };
    }

    const target = rest.join(" ").trim();
    return { actionType, target: target || undefined, rawInput: raw };
  }
}
