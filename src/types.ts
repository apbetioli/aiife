import { z } from "zod";

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
  "respond",
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

export interface GameAction {
  actionType: ActionType;
  target?: string;
  secondaryTarget?: string;
  direction?: Direction;
}

export const ExitSchema = z.object({
  direction: z.enum(DIRECTIONS),
  targetRoomId: z.string(),
  locked: z.boolean(),
  description: z.string().optional(),
});

export type Exit = z.infer<typeof ExitSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  description: z.string(),
  traits: z.array(z.string()).default([]),
  visible: z.boolean(),
  containerId: z.string().optional(),
});

export type Item = z.infer<typeof ItemSchema>;

export const NPCSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  description: z.string(),
  dialogue: z.array(z.string()),
  dialogueIndex: z.number(),
});

export type NPC = z.infer<typeof NPCSchema>;

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
  interactions: Interaction[];
  currentRoomId: string;
  inventory: string[];
  turnCount: number;
  gameOver: boolean;
  flags: Map<string, boolean>;
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

export const RoomDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  exits: z.array(ExitSchema),
  itemIds: z.array(z.string()),
  npcIds: z.array(z.string()),
});

export type RoomDefinition = z.infer<typeof RoomDefinitionSchema>;

export const InteractionTriggerSchema = z.object({
  targetKeywords: z.array(z.string()).optional(),
  secondaryTargetKeywords: z.array(z.string()).optional(),
  itemId: z.string().optional(),
  roomId: z.string().optional(),
});

export type InteractionTrigger = z.infer<typeof InteractionTriggerSchema>;

export const InteractionConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("flagEquals"), flag: z.string(), value: z.boolean() }),
  z.object({ type: z.literal("inRoom"), roomId: z.string() }),
  z.object({ type: z.literal("hasItem"), itemId: z.string() }),
]);

export type InteractionCondition = z.infer<typeof InteractionConditionSchema>;

export const InteractionEffectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setFlag"), flag: z.string(), value: z.boolean() }),
  z.object({ type: z.literal("setItemVisible"), itemId: z.string(), visible: z.boolean() }),
  z.object({ type: z.literal("setItemDescription"), itemId: z.string(), description: z.string() }),
  z.object({ type: z.literal("clearItemContainer"), itemId: z.string() }),
  z.object({ type: z.literal("unlockExit"), roomId: z.string(), direction: z.string() }),
  z.object({ type: z.literal("setExitDescription"), roomId: z.string(), direction: z.string(), description: z.string() }),
]);

export type InteractionEffect = z.infer<typeof InteractionEffectSchema>;

export const InteractionSchema = z.object({
  id: z.string(),
  action: z.string(),
  trigger: InteractionTriggerSchema,
  conditions: z.array(InteractionConditionSchema).optional(),
  effects: z.array(InteractionEffectSchema).optional(),
  message: z.string(),
  failMessage: z.string().optional(),
  gameOver: z.boolean().optional(),
  isVictory: z.boolean().optional(),
});

export type Interaction = z.infer<typeof InteractionSchema>;

export const WorldDefinitionSchema = z.object({
  title: z.string(),
  welcomeMessage: z.string(),
  rooms: z.array(RoomDefinitionSchema),
  items: z.array(ItemSchema),
  npcs: z.array(NPCSchema),
  startRoomId: z.string(),
  flags: z.record(z.string(), z.boolean()),
  interactions: z.array(InteractionSchema).optional().default([]),
});

export type WorldDefinition = z.infer<typeof WorldDefinitionSchema>;

export interface ActionHandler {
  validate(action: GameAction, state: GameState): ValidationResult;
  execute(action: GameAction, state: GameState): ActionResult;
}
