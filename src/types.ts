import { z } from "zod";

export const DirectionSchema = z.enum([
	"north",
	"south",
	"east",
	"west",
	"up",
	"down",
	"northwest",
	"southeast",
	"southwest",
	"northeast",
	"in",
	"out",
]);

export type Direction = z.infer<typeof DirectionSchema>;

export interface GameAction {
	action: string;
	params: Record<string, unknown>;
}

export const ExitSchema = z.object({
	direction: DirectionSchema,
	targetRoomId: z.string(),
	locked: z.boolean().optional(),
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
	properties: z.record(z.string(), z.unknown()).default({}),
});

export type Item = z.infer<typeof ItemSchema>;

export const NPCSchema = z.object({
	id: z.string(),
	name: z.string(),
	aliases: z.array(z.string()),
	description: z.string(),
	dialogue: z.array(z.string()),
	dialogueIndex: z.number(),
	properties: z.record(z.string(), z.unknown()).default({}),
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
	flags: Map<string, unknown>;
	custom: Record<string, unknown>;
}

export interface ActionResult {
	message: string;
	success: boolean;
	gameOver?: boolean;
	isVictory?: boolean;
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

// Conditions and effects use a generic { type, ...rest } shape.
// Built-in types (flagEquals, inRoom, hasItem, etc.) are registered
// in the ActionRegistry. Game modules can register additional types.
export const InteractionConditionSchema = z
	.object({ type: z.string() })
	.passthrough();

export type InteractionCondition = z.infer<typeof InteractionConditionSchema>;

export const InteractionEffectSchema = z
	.object({ type: z.string() })
	.passthrough();

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

export const CustomActionBehaviorSchema = z.object({
	resolveTarget: z.enum(["item", "npc"]),
	requiredTrait: z.string().optional(),
	propertyField: z.string(),
	failMessage: z.string(),
});

export const CustomActionSchema = z.object({
	name: z.string(),
	description: z.string(),
	helpText: z.string(),
	toolSchema: z.object({
		properties: z.record(
			z.string(),
			z.object({ type: z.string() }).passthrough(),
		),
		required: z.array(z.string()).optional(),
	}),
	behavior: CustomActionBehaviorSchema,
});

export type CustomAction = z.infer<typeof CustomActionSchema>;

export const WorldDefinitionSchema = z.object({
	title: z.string(),
	welcomeMessage: z.string(),
	rooms: z.array(RoomDefinitionSchema),
	items: z.array(ItemSchema),
	npcs: z.array(NPCSchema),
	startRoomId: z.string(),
	flags: z.record(z.string(), z.unknown()),
	interactions: z.array(InteractionSchema).optional().default([]),
	customActions: z.array(CustomActionSchema).optional().default([]),
	actionsModule: z.string().optional(),
});

export type WorldDefinition = z.infer<typeof WorldDefinitionSchema>;
