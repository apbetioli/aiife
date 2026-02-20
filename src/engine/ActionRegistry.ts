import type {
  ActionHandler,
  ActionResult,
  ActionType,
  GameState,
  ParsedAction,
  ValidationResult,
} from "../types.js";
import {
  getCurrentRoom,
  getInventoryItems,
  getVisibleItems,
  getRoomNPCs,
  resolveItem,
  resolveNPC,
  isItemInRoom,
  isItemInInventory,
} from "./ActionValidator.js";

// ── Move ──

const moveHandler: ActionHandler = {
  validate(action, state) {
    if (!action.direction) {
      return { valid: false, error: "Which direction do you want to go?" };
    }
    const room = getCurrentRoom(state);
    const exit = room.exits.find((e) => e.direction === action.direction);
    if (!exit) {
      return { valid: false, error: `You can't go ${action.direction} from here.` };
    }
    if (exit.locked) {
      return {
        valid: false,
        error: exit.description ?? "That way is locked.",
      };
    }
    return { valid: true };
  },
  execute(action, state) {
    const room = getCurrentRoom(state);
    const exit = room.exits.find((e) => e.direction === action.direction)!;
    state.currentRoomId = exit.targetRoomId;
    const newRoom = getCurrentRoom(state);
    const items = getVisibleItems(state);
    const npcs = getRoomNPCs(state);

    let message = `\n**${newRoom.name}**\n${newRoom.description}`;
    if (items.length > 0) {
      message += `\n\nYou can see: ${items.map((i) => i.name).join(", ")}.`;
    }
    if (npcs.length > 0) {
      message += `\n\n${npcs.map((n) => `There is a ${n.name} here.`).join(" ")}`;
    }
    return { message, success: true };
  },
};

// ── Look ──

const lookHandler: ActionHandler = {
  validate() {
    return { valid: true };
  },
  execute(_action, state) {
    const room = getCurrentRoom(state);
    const items = getVisibleItems(state);
    const npcs = getRoomNPCs(state);
    const exits = room.exits.map((e) => {
      let label = e.direction;
      if (e.locked) label += " (locked)";
      return label;
    });

    let message = `\n**${room.name}**\n${room.description}`;
    if (items.length > 0) {
      message += `\n\nYou can see: ${items.map((i) => i.name).join(", ")}.`;
    }
    if (npcs.length > 0) {
      message += `\n\n${npcs.map((n) => `There is a ${n.name} here.`).join(" ")}`;
    }
    message += `\n\nExits: ${exits.join(", ")}.`;
    return { message, success: true };
  },
};

// ── Examine ──

const examineHandler: ActionHandler = {
  validate(action, state) {
    if (!action.target) {
      return { valid: false, error: "What do you want to examine?" };
    }

    // Special case: examining the alcove in the library
    const lower = action.target.toLowerCase();
    if (
      (lower.includes("alcove") || lower.includes("wall")) &&
      state.currentRoomId === "library"
    ) {
      return { valid: true };
    }

    const item = resolveItem(action.target, state);
    const npc = resolveNPC(action.target, state);
    if (!item && !npc) {
      return { valid: false, error: `You don't see any "${action.target}" here.` };
    }
    return { valid: true };
  },
  execute(action, state) {
    const lower = (action.target ?? "").toLowerCase();

    // Special: examine alcove in library reveals the key
    if (
      (lower.includes("alcove") || lower.includes("wall")) &&
      state.currentRoomId === "library"
    ) {
      if (!state.flags.get("key-revealed")) {
        state.flags.set("key-revealed", true);
        const key = state.items.get("rusty-key");
        if (key) key.visible = true;
        return {
          message:
            "You peer into the shadowy alcove and run your fingers along the dusty stone. Your hand closes around something cold and metallic — a rusty key, hidden in a crack in the wall!",
          success: true,
        };
      }
      return {
        message: "The alcove is empty now. You already found the key that was hidden here.",
        success: true,
      };
    }

    const item = resolveItem(action.target, state);
    if (item) {
      return { message: item.description, success: true };
    }

    const npc = resolveNPC(action.target, state);
    if (npc) {
      return { message: npc.description, success: true };
    }

    return { message: `You don't see any "${action.target}" here.`, success: false };
  },
};

// ── Take ──

const takeHandler: ActionHandler = {
  validate(action, state) {
    if (!action.target) {
      return { valid: false, error: "What do you want to take?" };
    }
    const item = resolveItem(action.target, state);
    if (!item) {
      return { valid: false, error: `You don't see any "${action.target}" here.` };
    }
    if (!item.portable) {
      return { valid: false, error: `You can't pick up the ${item.name}.` };
    }
    if (isItemInInventory(item.id, state)) {
      return { valid: false, error: `You already have the ${item.name}.` };
    }
    if (!isItemInRoom(item.id, state)) {
      return { valid: false, error: `The ${item.name} isn't here.` };
    }
    return { valid: true };
  },
  execute(action, state) {
    const item = resolveItem(action.target, state)!;
    const room = getCurrentRoom(state);
    room.itemIds = room.itemIds.filter((id) => id !== item.id);
    state.inventory.push(item.id);
    return { message: `You pick up the ${item.name}.`, success: true };
  },
};

// ── Drop ──

const dropHandler: ActionHandler = {
  validate(action, state) {
    if (!action.target) {
      return { valid: false, error: "What do you want to drop?" };
    }
    const item = resolveItem(action.target, state);
    if (!item) {
      return { valid: false, error: `You don't have any "${action.target}".` };
    }
    if (!isItemInInventory(item.id, state)) {
      return { valid: false, error: `You don't have the ${item.name}.` };
    }
    return { valid: true };
  },
  execute(action, state) {
    const item = resolveItem(action.target, state)!;
    state.inventory = state.inventory.filter((id) => id !== item.id);
    const room = getCurrentRoom(state);
    room.itemIds.push(item.id);
    return { message: `You drop the ${item.name}.`, success: true };
  },
};

// ── Inventory ──

const inventoryHandler: ActionHandler = {
  validate() {
    return { valid: true };
  },
  execute(_action, state) {
    const items = getInventoryItems(state);
    if (items.length === 0) {
      return { message: "You are empty-handed.", success: true };
    }
    const list = items.map((i) => `  - ${i.name}`).join("\n");
    return { message: `You are carrying:\n${list}`, success: true };
  },
};

// ── Talk ──

const talkHandler: ActionHandler = {
  validate(action, state) {
    if (!action.target) {
      return { valid: false, error: "Who do you want to talk to?" };
    }
    const npc = resolveNPC(action.target, state);
    if (!npc) {
      return { valid: false, error: `You don't see anyone called "${action.target}" here.` };
    }
    return { valid: true };
  },
  execute(action, state) {
    const npc = resolveNPC(action.target, state)!;
    const line = npc.dialogue[npc.dialogueIndex];
    if (npc.dialogueIndex < npc.dialogue.length - 1) {
      npc.dialogueIndex++;
    }
    return { message: line, success: true };
  },
};

// ── Open ──

const openHandler: ActionHandler = {
  validate(action, state) {
    if (!action.target) {
      return { valid: false, error: "What do you want to open?" };
    }
    const lower = action.target.toLowerCase();

    // Opening the cellar door
    if (lower.includes("door") || lower.includes("iron")) {
      const room = getCurrentRoom(state);
      const downExit = room.exits.find((e) => e.direction === "down");
      if (!downExit) {
        return { valid: false, error: "There's no door like that here." };
      }
      if (!downExit.locked) {
        return { valid: false, error: "The door is already open." };
      }
      return { valid: false, error: "The iron door is locked. You need a key." };
    }

    // Opening the chest
    const item = resolveItem(action.target, state);
    if (!item) {
      return { valid: false, error: `You don't see any "${action.target}" to open.` };
    }
    if (item.id === "wooden-chest") {
      return { valid: true };
    }
    return { valid: false, error: `You can't open the ${item.name}.` };
  },
  execute(action, state) {
    const item = resolveItem(action.target, state);
    if (item?.id === "wooden-chest") {
      if (state.flags.get("chest-opened")) {
        return { message: "The chest is already open. It's empty now.", success: true };
      }
      state.flags.set("chest-opened", true);
      const amulet = state.items.get("gold-amulet");
      if (amulet) {
        amulet.visible = true;
        amulet.containerId = undefined;
      }
      const chest = state.items.get("wooden-chest");
      if (chest) {
        chest.description = "An ornate wooden chest with iron bindings. It is open and empty.";
      }
      return {
        message:
          "You heave open the heavy lid of the chest. Inside, nestled in faded velvet, is a gleaming gold amulet!",
        success: true,
      };
    }
    return { message: "You can't open that.", success: false };
  },
};

// ── Use (puzzle logic) ──

interface UseEffect {
  requires: { itemId: string; targetId?: string; roomId?: string };
  execute: (state: GameState) => ActionResult;
}

const useEffects: UseEffect[] = [
  {
    // Use key on door → unlock cellar
    requires: { itemId: "rusty-key", targetId: "door" },
    execute(state) {
      const hall = state.rooms.get("great-hall");
      if (!hall) return { message: "Something went wrong.", success: false };
      const downExit = hall.exits.find((e) => e.direction === "down");
      if (!downExit) return { message: "Something went wrong.", success: false };
      if (!downExit.locked) {
        return { message: "The door is already unlocked.", success: true };
      }
      downExit.locked = false;
      downExit.description = "The heavy iron door in the floor stands open.";
      state.flags.set("cellar-unlocked", true);
      return {
        message:
          "You fit the rusty key into the lock. With a grinding screech, the mechanism turns. The heavy iron door swings open, revealing stone steps descending into darkness.",
        success: true,
      };
    },
  },
  {
    // Use key directly (when in great hall, implied target)
    requires: { itemId: "rusty-key", roomId: "great-hall" },
    execute(state) {
      const hall = state.rooms.get("great-hall");
      if (!hall) return { message: "Something went wrong.", success: false };
      const downExit = hall.exits.find((e) => e.direction === "down");
      if (!downExit || !downExit.locked) {
        return { message: "The door is already unlocked.", success: true };
      }
      downExit.locked = false;
      downExit.description = "The heavy iron door in the floor stands open.";
      state.flags.set("cellar-unlocked", true);
      return {
        message:
          "You fit the rusty key into the lock of the iron door. With a grinding screech, the mechanism turns. The heavy iron door swings open, revealing stone steps descending into darkness.",
        success: true,
      };
    },
  },
  {
    // Use amulet on pedestal → win
    requires: { itemId: "gold-amulet", targetId: "pedestal" },
    execute(state) {
      state.flags.set("game-won", true);
      state.gameOver = true;
      return {
        message:
          "You place the gold amulet into the depression on the pedestal. The runes flare with brilliant light, and the entire cellar trembles. The walls dissolve into radiance, and you feel yourself lifted beyond the ancient stones.\n\n**You have unlocked the secret of the castle. You win!**",
        success: true,
        gameOver: true,
        isVictory: true,
      };
    },
  },
  {
    // Use amulet directly in cellar (implied target)
    requires: { itemId: "gold-amulet", roomId: "cellar" },
    execute(state) {
      state.flags.set("game-won", true);
      state.gameOver = true;
      return {
        message:
          "You place the gold amulet into the depression on the stone pedestal. The runes flare with brilliant light, and the entire cellar trembles. The walls dissolve into radiance, and you feel yourself lifted beyond the ancient stones.\n\n**You have unlocked the secret of the castle. You win!**",
        success: true,
        gameOver: true,
        isVictory: true,
      };
    },
  },
];

function matchUseTarget(
  targetName: string | undefined,
  requiredId: string
): boolean {
  if (!targetName) return false;
  const lower = targetName.toLowerCase();
  return (
    lower.includes(requiredId.replace(/-/g, " ")) ||
    requiredId.includes(lower.replace(/\s+/g, "-")) ||
    lower.includes(requiredId.split("-").pop() ?? "")
  );
}

const useHandler: ActionHandler = {
  validate(action, state) {
    if (!action.target) {
      return { valid: false, error: "What do you want to use?" };
    }
    const item = resolveItem(action.target, state);
    if (!item) {
      return { valid: false, error: `You don't have any "${action.target}".` };
    }
    if (!isItemInInventory(item.id, state)) {
      return { valid: false, error: `You need to pick up the ${item.name} first.` };
    }
    return { valid: true };
  },
  execute(action, state) {
    const item = resolveItem(action.target, state)!;

    // Check puzzle effects with explicit target
    for (const effect of useEffects) {
      if (effect.requires.itemId !== item.id) continue;

      if (effect.requires.targetId) {
        if (matchUseTarget(action.secondaryTarget, effect.requires.targetId)) {
          return effect.execute(state);
        }
      } else if (effect.requires.roomId) {
        if (
          state.currentRoomId === effect.requires.roomId &&
          !action.secondaryTarget
        ) {
          return effect.execute(state);
        }
      }
    }

    return {
      message: `You're not sure how to use the ${item.name}${action.secondaryTarget ? ` on the ${action.secondaryTarget}` : ""} here.`,
      success: false,
    };
  },
};

// ── Help ──

const helpHandler: ActionHandler = {
  validate() {
    return { valid: true };
  },
  execute() {
    return {
      message: `**Available commands:**
  - **look** (l) — Describe your surroundings
  - **go <direction>** (n/s/e/w/u/d) — Move in a direction
  - **examine <thing>** (x) — Look closely at something
  - **take <item>** — Pick up an item
  - **drop <item>** — Put down an item
  - **use <item>** / **use <item> on <target>** — Use an item
  - **open <thing>** — Open something
  - **talk to <person>** — Speak with someone
  - **inventory** (i) — Check what you're carrying
  - **help** — Show this message
  - **quit** — End the game`,
      success: true,
    };
  },
};

// ── Quit ──

const quitHandler: ActionHandler = {
  validate() {
    return { valid: true };
  },
  execute(_action, state) {
    state.gameOver = true;
    return {
      message: "Thanks for playing Zorky! Goodbye.",
      success: true,
      gameOver: true,
    };
  },
};

// ── Registry ──

const handlers: Record<ActionType, ActionHandler> = {
  move: moveHandler,
  look: lookHandler,
  examine: examineHandler,
  take: takeHandler,
  drop: dropHandler,
  inventory: inventoryHandler,
  talk: talkHandler,
  open: openHandler,
  use: useHandler,
  help: helpHandler,
  quit: quitHandler,
};

export function getActionHandler(actionType: ActionType): ActionHandler {
  return handlers[actionType];
}

export function validateAction(
  action: ParsedAction,
  state: GameState
): ValidationResult {
  return getActionHandler(action.actionType).validate(action, state);
}

export function executeAction(
  action: ParsedAction,
  state: GameState
): ActionResult {
  return getActionHandler(action.actionType).execute(action, state);
}
