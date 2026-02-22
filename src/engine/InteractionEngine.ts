import type {
  ActionResult,
  GameAction,
  GameState,
  Interaction,
} from "../types.js";
import { resolveItem } from "./ActionValidator.js";

function keywordMatches(text: string | undefined, keywords: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function triggerMatches(
  interaction: Interaction,
  action: GameAction,
  state: GameState
): boolean {
  const { trigger } = interaction;

  if (trigger.roomId && state.currentRoomId !== trigger.roomId) return false;

  if (trigger.itemId) {
    const item = resolveItem(action.target, state);
    if (!item || item.id !== trigger.itemId) return false;
  }

  if (trigger.targetKeywords) {
    if (!keywordMatches(action.target, trigger.targetKeywords)) return false;
  }

  if (trigger.secondaryTargetKeywords) {
    if (
      !keywordMatches(action.secondaryTarget, trigger.secondaryTargetKeywords)
    )
      return false;
  } else if (action.secondaryTarget) {
    return false;
  }

  return true;
}

function conditionsMet(
  interaction: Interaction,
  state: GameState
): boolean {
  if (!interaction.conditions) return true;

  return interaction.conditions.every((cond) => {
    switch (cond.type) {
      case "flagEquals":
        return (state.flags.get(cond.flag) ?? false) === cond.value;
      case "inRoom":
        return state.currentRoomId === cond.roomId;
      case "hasItem":
        return state.inventory.includes(cond.itemId);
    }
  });
}

export function findInteraction(
  actionType: string,
  action: GameAction,
  state: GameState
): Interaction | undefined {
  return state.interactions.find(
    (i) =>
      i.action === actionType &&
      triggerMatches(i, action, state) &&
      conditionsMet(i, state)
  );
}

export function applyEffects(
  interaction: Interaction,
  state: GameState
): void {
  if (!interaction.effects) return;

  for (const effect of interaction.effects) {
    switch (effect.type) {
      case "setFlag":
        state.flags.set(effect.flag, effect.value);
        break;
      case "setItemVisible": {
        const item = state.items.get(effect.itemId);
        if (item) item.visible = effect.visible;
        break;
      }
      case "setItemDescription": {
        const item = state.items.get(effect.itemId);
        if (item) item.description = effect.description;
        break;
      }
      case "clearItemContainer": {
        const item = state.items.get(effect.itemId);
        if (item) item.containerId = undefined;
        break;
      }
      case "unlockExit": {
        const room = state.rooms.get(effect.roomId);
        const exit = room?.exits.find((e) => e.direction === effect.direction);
        if (exit) exit.locked = false;
        break;
      }
      case "setExitDescription": {
        const room = state.rooms.get(effect.roomId);
        const exit = room?.exits.find((e) => e.direction === effect.direction);
        if (exit) exit.description = effect.description;
        break;
      }
    }
  }
}

export function executeInteraction(
  interaction: Interaction,
  state: GameState
): ActionResult {
  applyEffects(interaction, state);

  if (interaction.gameOver) {
    state.gameOver = true;
  }

  return {
    message: interaction.message,
    success: true,
    gameOver: interaction.gameOver || undefined,
    isVictory: interaction.isVictory || undefined,
  };
}
