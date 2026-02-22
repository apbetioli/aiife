import type {
  ActionHandler,
  ActionResult,
  ActionType,
  GameAction,
  GameState,
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
import {
  findInteraction,
  executeInteraction,
} from "./InteractionEngine.js";

const moveHandler: ActionHandler = {
  run(action, state) {
    if (!action.direction) {
      return { success: false, message: "Which direction do you want to go?" };
    }
    const room = getCurrentRoom(state);
    const exit = room.exits.find((e) => e.direction === action.direction);
    if (!exit) {
      return {
        success: false,
        message: `You can't go ${action.direction} from here.`,
      };
    }
    if (exit.locked) {
      return {
        success: false,
        message: exit.description ?? "That way is locked.",
      };
    }

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

const lookHandler: ActionHandler = {
  run(_action, state) {
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

const examineHandler: ActionHandler = {
  run(action, state) {
    if (!action.target) {
      return { success: false, message: "What do you want to examine?" };
    }

    const item = resolveItem(action.target, state);
    const npc = resolveNPC(action.target, state);

    const interaction = findInteraction("examine", action, state);
    if (interaction) return executeInteraction(interaction, state);

    if (item) return { message: item.description, success: true };

    if (npc) return { message: npc.description, success: true };

    return { message: `You don't see any "${action.target}" here.`, success: false };
  },
};

const takeHandler: ActionHandler = {
  run(action, state) {
    if (!action.target) {
      return { success: false, message: "What do you want to take?" };
    }

    const item = resolveItem(action.target, state);
    if (!item) {
      return {
        success: false,
        message: `You don't see any "${action.target}" here.`,
      };
    }
    if (!item.traits.includes("portable")) {
      return { success: false, message: `You can't pick up the ${item.name}.` };
    }
    if (isItemInInventory(item.id, state)) {
      return { success: false, message: `You already have the ${item.name}.` };
    }
    if (!isItemInRoom(item.id, state)) {
      return { success: false, message: `The ${item.name} isn't here.` };
    }

    const room = getCurrentRoom(state);
    room.itemIds = room.itemIds.filter((id) => id !== item.id);
    state.inventory.push(item.id);
    return { message: `You pick up the ${item.name}.`, success: true };
  },
};

const dropHandler: ActionHandler = {
  run(action, state) {
    if (!action.target) {
      return { success: false, message: "What do you want to drop?" };
    }

    const item = resolveItem(action.target, state);
    if (!item) {
      return {
        success: false,
        message: `You don't have any "${action.target}".`,
      };
    }
    if (!isItemInInventory(item.id, state)) {
      return { success: false, message: `You don't have the ${item.name}.` };
    }

    state.inventory = state.inventory.filter((id) => id !== item.id);
    const room = getCurrentRoom(state);
    room.itemIds.push(item.id);
    return { message: `You drop the ${item.name}.`, success: true };
  },
};

const inventoryHandler: ActionHandler = {
  run(_action, state) {
    const items = getInventoryItems(state);
    if (items.length === 0) {
      return { message: "You are empty-handed.", success: true };
    }
    const list = items.map((i) => `  - ${i.name}`).join("\n");
    return { message: `You are carrying:\n${list}`, success: true };
  },
};

const talkHandler: ActionHandler = {
  run(action, state) {
    if (!action.target) {
      return { success: false, message: "Who do you want to talk to?" };
    }

    const npc = resolveNPC(action.target, state);
    if (!npc) {
      return {
        success: false,
        message: `You don't see anyone called "${action.target}" here.`,
      };
    }

    const line = npc.dialogue[npc.dialogueIndex];
    if (npc.dialogueIndex < npc.dialogue.length - 1) {
      npc.dialogueIndex++;
    }
    return { message: line, success: true };
  },
};

const openHandler: ActionHandler = {
  run(action, state) {
    if (!action.target) {
      return { success: false, message: "What do you want to open?" };
    }

    const room = getCurrentRoom(state);
    const lockedExit = room.exits.find(
      (e) => e.description?.toLowerCase().includes(action.target!.toLowerCase())
    );
    if (lockedExit) {
      if (!lockedExit.locked) {
        return { success: false, message: "It's already open." };
      }
      return {
        success: false,
        message: lockedExit.description ?? "That way is locked.",
      };
    }

    const item = resolveItem(action.target, state);
    if (!item) {
      return {
        success: false,
        message: `You don't see any "${action.target}" to open.`,
      };
    }
    if (!item.traits.includes("openable")) {
      return { success: false, message: `You can't open the ${item.name}.` };
    }

    const interaction = findInteraction("open", action, state);
    if (!interaction) {
      return { success: false, message: `You can't open the ${item.name}.` };
    }
    return executeInteraction(interaction, state);
  },
};

const useHandler: ActionHandler = {
  run(action, state) {
    if (!action.target) {
      return { success: false, message: "What do you want to use?" };
    }

    const item = resolveItem(action.target, state);
    if (!item) {
      return {
        success: false,
        message: `You don't have any "${action.target}".`,
      };
    }
    if (!isItemInInventory(item.id, state)) {
      return {
        success: false,
        message: `You need to pick up the ${item.name} first.`,
      };
    }

    const interaction = findInteraction("use", action, state);
    if (interaction) return executeInteraction(interaction, state);

    return {
      message: `You're not sure how to use the ${item.name}${action.secondaryTarget ? ` on the ${action.secondaryTarget}` : ""} here.`,
      success: false,
    };
  },
};

const COMMAND_HELP: [string, string][] = [
  ["look", "**look** (l) — Describe your surroundings"],
  ["move", "**go <direction>** (n/s/e/w/u/d) — Move in a direction"],
  ["examine", "**examine <thing>** (x) — Look closely at something"],
  ["take", "**take <item>** — Pick up an item"],
  ["drop", "**drop <item>** — Put down an item"],
  ["use", "**use <item>** / **use <item> on <target>** — Use an item"],
  ["open", "**open <thing>** — Open something"],
  ["talk", "**talk to <person>** — Speak with someone"],
  ["inventory", "**inventory** (i) — Check what you're carrying"],
  ["help", "**help** — Show this message"],
  ["quit", "**quit** — End the game"],
];

const helpHandler: ActionHandler = {
  run() {
    const registered = new Set(Object.keys(handlers));
    const lines = COMMAND_HELP
      .filter(([key]) => registered.has(key))
      .map(([, desc]) => `  - ${desc}`);
    return {
      message: `**Available commands:**\n${lines.join("\n")}`,
      success: true,
    };
  },
};

const quitHandler: ActionHandler = {
  run(_action, state) {
    state.gameOver = true;
    return {
      message: "Thanks for playing! Goodbye.",
      success: true,
      gameOver: true,
    };
  },
};

const respondHandler: ActionHandler = {
  run(action) {
    return { success: true, message: action.target ?? "" };
  },
};

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
  respond: respondHandler,
};

export function getActionHandler(actionType: ActionType): ActionHandler {
  return handlers[actionType];
}

export function runAction(
  action: GameAction,
  state: GameState
): ActionResult {
  return getActionHandler(action.actionType).run(action, state);
}
