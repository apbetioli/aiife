import type { GameAction } from "../types.js";
import { DIRECTIONS } from "../types.js";

const DIRECTION_ALIASES: Record<string, GameAction["direction"]> = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  u: "up",
  d: "down",
  north: "north",
  south: "south",
  east: "east",
  west: "west",
  up: "up",
  down: "down",
};

export function parseCommand(input: string): GameAction | null {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  // look / l
  if (lower === "look" || lower === "l") {
    return { actionType: "look" };
  }

  // inventory / i / inv
  if (lower === "inventory" || lower === "i" || lower === "inv") {
    return { actionType: "inventory" };
  }

  // help / ?
  if (lower === "help" || lower === "?") {
    return { actionType: "help" };
  }

  // quit / q / exit
  if (lower === "quit" || lower === "q" || lower === "exit") {
    return { actionType: "quit" };
  }

  // bare direction: n / north / s / south / ...
  if (lower in DIRECTION_ALIASES) {
    return { actionType: "move", direction: DIRECTION_ALIASES[lower] };
  }

  // go <direction>
  const goMatch = lower.match(/^go\s+(\S+)$/);
  if (goMatch) {
    const dir = DIRECTION_ALIASES[goMatch[1]];
    if (dir) return { actionType: "move", direction: dir };
  }

  // move <direction>
  const moveMatch = lower.match(/^move\s+(\S+)$/);
  if (moveMatch) {
    const dir = DIRECTION_ALIASES[moveMatch[1]];
    if (dir) return { actionType: "move", direction: dir };
  }

  // examine <x> / x <x> / look at <x>
  const examineMatch =
    lower.match(/^(?:examine|ex|x)\s+(.+)$/) ??
    lower.match(/^look\s+at\s+(.+)$/);
  if (examineMatch) {
    return { actionType: "examine", target: examineMatch[1].trim() };
  }

  // take <x> / get <x> / pick up <x>
  const takeMatch =
    lower.match(/^(?:take|get)\s+(.+)$/) ??
    lower.match(/^pick\s+up\s+(.+)$/);
  if (takeMatch) {
    return { actionType: "take", target: takeMatch[1].trim() };
  }

  // drop <x> / put down <x>
  const dropMatch =
    lower.match(/^drop\s+(.+)$/) ?? lower.match(/^put\s+down\s+(.+)$/);
  if (dropMatch) {
    return { actionType: "drop", target: dropMatch[1].trim() };
  }

  // use <x> on <y>
  const useOnMatch = lower.match(/^use\s+(.+?)\s+on\s+(.+)$/);
  if (useOnMatch) {
    return {
      actionType: "use",
      target: useOnMatch[1].trim(),
      secondaryTarget: useOnMatch[2].trim(),
    };
  }

  // use <x>
  const useMatch = lower.match(/^use\s+(.+)$/);
  if (useMatch) {
    return { actionType: "use", target: useMatch[1].trim() };
  }

  // open <x>
  const openMatch = lower.match(/^open\s+(.+)$/);
  if (openMatch) {
    return { actionType: "open", target: openMatch[1].trim() };
  }

  // talk to <x> / talk <x> / speak to <x> / speak with <x>
  const talkMatch =
    lower.match(/^talk\s+(?:to\s+)?(.+)$/) ??
    lower.match(/^speak\s+(?:to|with)\s+(.+)$/);
  if (talkMatch) {
    return { actionType: "talk", target: talkMatch[1].trim() };
  }

  return null;
}

/** Reverse-maps a GameAction back to an Anthropic tool name and input object. */
export function actionToToolParams(
  action: GameAction
): { name: string; input: Record<string, string> } {
  switch (action.actionType) {
    case "move":
      return { name: "move", input: { direction: action.direction ?? "" } };
    case "take":
      return { name: "take", input: { item: action.target ?? "" } };
    case "drop":
      return { name: "drop", input: { item: action.target ?? "" } };
    case "use":
      return {
        name: "use",
        input: {
          item: action.target ?? "",
          ...(action.secondaryTarget ? { target: action.secondaryTarget } : {}),
        },
      };
    case "examine":
      return { name: "examine", input: { target: action.target ?? "" } };
    case "look":
      return { name: "look", input: {} };
    case "talk":
      return { name: "talk", input: { npc: action.target ?? "" } };
    case "open":
      return { name: "open", input: { target: action.target ?? "" } };
    case "inventory":
      return { name: "inventory", input: {} };
    case "help":
      return { name: "help", input: {} };
    case "quit":
      return { name: "quit", input: {} };
    case "respond":
      return { name: "respond", input: { message: action.target ?? "" } };
  }
}
