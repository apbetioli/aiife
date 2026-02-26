import { BUILT_IN_ACTIONS } from "../src/engine/ActionRegistry";
import type { GameStateSnapshot } from "./types";

/**
 * Plain-text descriptions of each game action from the built-in action registry.
 * TODO add the input schema?
 */
const ACTION_DESCRIPTIONS: Record<string, string> = BUILT_IN_ACTIONS.reduce(
	(acc, action) => {
		acc[action.name] = action.description;
		return acc;
	},
	{} as Record<string, string>,
);

export function buildAvailableActionsPrompt(actionNames: string[]): string {
	const descriptions = actionNames
		.filter((name) => name in ACTION_DESCRIPTIONS)
		.map((name) => `- ${ACTION_DESCRIPTIONS[name]}`);

	return `Available actions:\n${descriptions.join("\n")}`;
}

export function buildGameStateSnapshotPrompt(state: GameStateSnapshot): string {
	const exits = state.exits.map((e) =>
		e.locked ? `${e.direction} (locked)` : e.direction,
	);

	return `Current state:
  - Room: ${state.roomName} — ${state.roomDescription}
  - Exits: ${exits.length > 0 ? exits.join(", ") : "none"}
  - Visible items: ${state.visibleItems.length > 0 ? state.visibleItems.join(", ") : "none"}
  - Inventory: ${state.inventory.length > 0 ? state.inventory.join(", ") : "empty"}
  - NPCs here: ${state.npcsHere.length > 0 ? state.npcsHere.join(", ") : "none"}`;
}

const STRUCTURED_OUTPUT_SYSTEM_PROMPT = `You are an intent parser for a text adventure game. Given the player's input and the current game state, determine which single game action the player intends to perform.

Rules:
- Choose exactly ONE action from the available actions list.
- Return the action name and its parameters as structured JSON.
- Normalize direction abbreviations: n=north, s=south, e=east, w=west, u=up, d=down.
- Match parameter values to names visible in the game state (items, NPCs, exits).
- If the player input is ambiguous, incomplete, or conversational (not a clear game command), use the "respond" action with an appropriate clarifying message.
- For "look" with no target, use the "look" action. For "look at <something>", use the "examine" action.
- For inventory queries like "what am I carrying?", use the "inventory" action.
- For "take all" or "take everything", list ALL visible items in the items array.
- For "drop all but X", list ALL inventory items EXCEPT X in the items array.
- For "take X and Y", list each item name in the items array.`;

export function buildStructuredOutputSystemPrompt(
	gameState: GameStateSnapshot,
	actions: string[],
): string {
	return [
		STRUCTURED_OUTPUT_SYSTEM_PROMPT,
		"",
		buildGameStateSnapshotPrompt(gameState),
		"",
		buildAvailableActionsPrompt(actions),
	].join("\n");
}
