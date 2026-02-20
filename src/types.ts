export const ACTION_TYPES = [
  "move",
  "take",
  "drop",
  "use",
  "examine",
  "look",
  "inventory",
  "talk",
  "open",
  "help",
  "quit",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export const DIRECTIONS = [
  "north",
  "south",
  "east",
  "west",
  "up",
  "down",
] as const;

export type Direction = (typeof DIRECTIONS)[number];

export interface ParsedAction {
  actionType: ActionType;
  target?: string;
  secondaryTarget?: string;
  direction?: Direction;
  rawInput: string;
}

export interface Exit {
  direction: Direction;
  targetRoomId: string;
  locked: boolean;
  description?: string;
}

export interface Item {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  portable: boolean;
  visible: boolean;
  containerId?: string;
}

export interface NPC {
  id: string;
  name: string;
  aliases: string[];
  description: string;
  dialogue: string[];
  dialogueIndex: number;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  exits: Exit[];
  itemIds: string[];
  npcIds: string[];
}

export interface GameState {
  rooms: Map<string, Room>;
  items: Map<string, Item>;
  npcs: Map<string, NPC>;
  currentRoomId: string;
  inventory: string[];
  turnCount: number;
  gameOver: boolean;
  flags: Map<string, boolean>;
  /** Welcome message shown at game start; defined by the game/world. */
  welcomeMessage?: string;
}

export interface ActionResult {
  message: string;
  success: boolean;
  gameOver?: boolean;
  isVictory?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface RoomDefinition {
  id: string;
  name: string;
  description: string;
  exits: Exit[];
  itemIds: string[];
  npcIds: string[];
}

export interface WorldDefinition {
  title?: string;
  /** Welcome message shown at game start. */
  welcomeMessage?: string;
  rooms: RoomDefinition[];
  items: Item[];
  npcs: NPC[];
  startRoomId: string;
  flags: Record<string, boolean>;
}

export interface ParserContext {
  roomName: string;
  roomDescription: string;
  exits: string[];
  visibleItems: string[];
  inventory: string[];
  npcs: string[];
}

export interface Parser {
  parseInput(input: string, context: ParserContext): Promise<ParsedAction>;
}

export interface ActionHandler {
  validate(action: ParsedAction, state: GameState): ValidationResult;
  execute(action: ParsedAction, state: GameState): ActionResult;
}
