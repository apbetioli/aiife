import { type Tool, tool } from "ai";
import { z } from "zod";
import type {
	ActionResult,
	CustomAction,
	GameState,
	Interaction,
} from "../types.js";
import { resolveItem, resolveNPC } from "./ActionValidator.js";
import { dropAction } from "./actions/drop-action.js";
import { examineAction } from "./actions/examine-action.js";
import { goAction } from "./actions/go-action.js";
import { helpAction } from "./actions/help-action.js";
import { inventoryAction } from "./actions/inventory-action.js";
import { lookAction } from "./actions/look-action.js";
import { openAction } from "./actions/open-action.js";
import { quitAction } from "./actions/quit-action.js";
import { respondAction } from "./actions/respond-action.js";
import { takeAction } from "./actions/take-action.js";
import { talkAction } from "./actions/talk-action.js";
import { useAction } from "./actions/use-action.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ParsePattern {
	pattern: RegExp;
	extract: (match: RegExpMatchArray) => Record<string, unknown>;
}

export type ActionHandlerFn = (
	params: Record<string, unknown>,
	state: GameState,
	registry: ActionRegistry,
) => ActionResult;

export type WrapperFn = (
	params: Record<string, unknown>,
	state: GameState,
	next: (params: Record<string, unknown>, state: GameState) => ActionResult,
) => ActionResult;

export interface ActionDefinition {
	name: string;
	description: string;
	helpText: string;
	inputSchema: z.ZodObject<Record<string, z.ZodTypeAny>>;
	parsePatterns: ParsePattern[];
	handler: ActionHandlerFn;
}

export type ConditionChecker = (
	condition: Record<string, unknown>,
	state: GameState,
	params: Record<string, unknown>,
) => boolean;

export type EffectApplier = (
	effect: Record<string, unknown>,
	state: GameState,
) => void;

// ---------------------------------------------------------------------------
// Interaction trigger helpers
// ---------------------------------------------------------------------------

function keywordMatches(text: string | undefined, keywords: string[]): boolean {
	if (!text) return false;
	const lower = text.toLowerCase();
	return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/** Primary target: items[0] > item > target > npc (matches old action.target semantics). */
function getPrimaryTarget(params: Record<string, unknown>): string | undefined {
	const items = params.items as string[] | undefined;
	return (items?.[0] ?? params.item ?? params.target ?? params.npc) as
		| string
		| undefined;
}

/** Secondary target: params.target when params.item is the primary (e.g. "use key on door"). */
function getSecondaryTarget(
	params: Record<string, unknown>,
): string | undefined {
	if (params.item && params.target) return params.target as string;
	return undefined;
}

// ---------------------------------------------------------------------------
// ActionRegistry
// ---------------------------------------------------------------------------

export class ActionRegistry {
	private definitions = new Map<string, ActionDefinition>();
	private wrappers = new Map<string, WrapperFn[]>();
	private conditionCheckers = new Map<string, ConditionChecker>();
	private effectAppliers = new Map<string, EffectApplier>();
	private gameStartHooks: ((state: GameState) => void)[] = [];

	// -- Registration --------------------------------------------------------

	register(definition: ActionDefinition): void {
		this.definitions.set(definition.name, definition);
	}

	wrap(name: string, wrapper: WrapperFn): void {
		const list = this.wrappers.get(name) ?? [];
		list.push(wrapper);
		this.wrappers.set(name, list);
	}

	registerCondition(type: string, checker: ConditionChecker): void {
		this.conditionCheckers.set(type, checker);
	}

	registerEffect(type: string, applier: EffectApplier): void {
		this.effectAppliers.set(type, applier);
	}

	onGameStart(hook: (state: GameState) => void): void {
		this.gameStartHooks.push(hook);
	}

	runGameStartHooks(state: GameState): void {
		for (const hook of this.gameStartHooks) hook(state);
	}

	// -- Execution pipeline --------------------------------------------------

	run(
		action: string,
		params: Record<string, unknown>,
		state: GameState,
	): ActionResult {
		const definition = this.definitions.get(action);
		if (!definition) {
			return { success: false, message: `Unknown action: ${action}` };
		}

		// Step 1: Check interactions (declarative overrides from JSON)
		const interactionResult = this.runInteractions(action, params, state);
		if (interactionResult) return interactionResult;

		// Step 2+3: Build wrapper chain around base handler, then run
		const wrapperList = this.wrappers.get(action) ?? [];
		let handler = (p: Record<string, unknown>, s: GameState) =>
			definition.handler(p, s, this);

		for (let i = wrapperList.length - 1; i >= 0; i--) {
			const wrapper = wrapperList[i];
			const next = handler;
			handler = (p, s) => wrapper(p, s, next);
		}

		return handler(params, state);
	}

	// -- Interactions --------------------------------------------------------

	runInteractions(
		action: string,
		params: Record<string, unknown>,
		state: GameState,
	): ActionResult | null {
		const interaction = this.findInteraction(action, params, state);
		if (!interaction) return null;
		return this.executeInteraction(interaction, state);
	}

	private findInteraction(
		action: string,
		params: Record<string, unknown>,
		state: GameState,
	): Interaction | undefined {
		return state.interactions.find(
			(i) =>
				i.action === action &&
				this.triggerMatches(i, params, state) &&
				this.conditionsMet(i, state, params),
		);
	}

	private triggerMatches(
		interaction: Interaction,
		params: Record<string, unknown>,
		state: GameState,
	): boolean {
		const { trigger } = interaction;
		const primary = getPrimaryTarget(params);
		const secondary = getSecondaryTarget(params);

		if (trigger.roomId && state.currentRoomId !== trigger.roomId) return false;

		if (trigger.itemId) {
			const item = resolveItem(primary, state);
			if (!item || item.id !== trigger.itemId) return false;
		}

		if (trigger.targetKeywords) {
			if (!keywordMatches(primary, trigger.targetKeywords)) return false;
		}

		if (trigger.secondaryTargetKeywords) {
			if (!keywordMatches(secondary, trigger.secondaryTargetKeywords))
				return false;
		} else if (secondary) {
			return false;
		}

		return true;
	}

	private conditionsMet(
		interaction: Interaction,
		state: GameState,
		params: Record<string, unknown>,
	): boolean {
		if (!interaction.conditions) return true;

		return interaction.conditions.every((cond) => {
			const checker = this.conditionCheckers.get(cond.type);
			if (!checker) return true; // unknown condition type → pass
			return checker(cond as Record<string, unknown>, state, params);
		});
	}

	private executeInteraction(
		interaction: Interaction,
		state: GameState,
	): ActionResult {
		this.applyEffects(interaction, state);

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

	private applyEffects(interaction: Interaction, state: GameState): void {
		if (!interaction.effects) return;

		for (const effect of interaction.effects) {
			const applier = this.effectAppliers.get(effect.type);
			if (applier) applier(effect as Record<string, unknown>, state);
		}
	}

	// -- Parsing -------------------------------------------------------------

	parseCommand(
		input: string,
	): { action: string; params: Record<string, unknown> } | null {
		const raw = input.trim();
		const lower = raw.toLowerCase();

		for (const [, definition] of this.definitions) {
			for (const pp of definition.parsePatterns) {
				const match = lower.match(pp.pattern);
				if (match) {
					return { action: definition.name, params: pp.extract(match) };
				}
			}
		}

		return null;
	}

	// -- Tool generation -----------------------------------------------------

	getTools(): Record<string, Tool> {
		const tools: Record<string, Tool> = {};
		for (const [name, def] of this.definitions) {
			tools[name] = tool({
				description: def.description,
				inputSchema: def.inputSchema,
			});
		}
		return tools;
	}

	getHelpLines(): string[] {
		return [...this.definitions.values()]
			.filter((d) => d.helpText)
			.map((d) => `  - ${d.helpText}`);
	}

	// -- Custom action registration from JSON --------------------------------

	registerCustomAction(custom: CustomAction): void {
		const shape: Record<string, z.ZodTypeAny> = {};
		for (const [key, prop] of Object.entries(custom.toolSchema.properties)) {
			let zodType: z.ZodTypeAny;
			switch (prop.type) {
				case "number":
					zodType = z.number();
					break;
				case "boolean":
					zodType = z.boolean();
					break;
				default:
					zodType = z.string();
					break;
			}
			if (!custom.toolSchema.required?.includes(key)) {
				zodType = zodType.optional();
			}
			shape[key] = zodType;
		}

		const inputSchema = z.object(shape);
		const paramKeys = Object.keys(custom.toolSchema.properties);
		const firstParam = paramKeys[0] ?? "target";

		this.register({
			name: custom.name,
			description: custom.description,
			helpText: custom.helpText,
			inputSchema,
			parsePatterns: [
				{
					pattern: new RegExp(`^${custom.name}\\s+(.+)$`),
					extract: (m) => ({ [firstParam]: m[1].trim() }),
				},
			],
			handler: (params, state) => {
				const targetName = params[firstParam] as string | undefined;

				const entity =
					custom.behavior.resolveTarget === "item"
						? resolveItem(targetName, state)
						: resolveNPC(targetName, state);

				if (!entity) {
					return {
						success: false,
						message: `You don't see any "${targetName}" here.`,
					};
				}

				if (
					custom.behavior.requiredTrait &&
					"traits" in entity &&
					!entity.traits.includes(custom.behavior.requiredTrait)
				) {
					return {
						success: false,
						message: custom.behavior.failMessage.replace(
							"{target}",
							entity.name,
						),
					};
				}

				const value =
					"properties" in entity
						? (entity.properties as Record<string, unknown>)[
								custom.behavior.propertyField
							]
						: undefined;

				if (!value) {
					return {
						success: false,
						message: custom.behavior.failMessage.replace(
							"{target}",
							entity.name,
						),
					};
				}

				return { success: true, message: String(value) };
			},
		});
	}
}

// ---------------------------------------------------------------------------
// Built-in conditions
// ---------------------------------------------------------------------------

export function registerBuiltinConditions(registry: ActionRegistry): void {
	registry.registerCondition("flagEquals", (cond, state) => {
		return (state.flags.get(cond.flag as string) ?? false) === cond.value;
	});

	registry.registerCondition("inRoom", (cond, state) => {
		return state.currentRoomId === (cond.roomId as string);
	});

	registry.registerCondition("hasItem", (cond, state) => {
		return state.inventory.includes(cond.itemId as string);
	});
}

// ---------------------------------------------------------------------------
// Built-in effects
// ---------------------------------------------------------------------------

export function registerBuiltinEffects(registry: ActionRegistry): void {
	registry.registerEffect("setFlag", (effect, state) => {
		state.flags.set(effect.flag as string, effect.value);
	});

	registry.registerEffect("setItemVisible", (effect, state) => {
		const item = state.items.get(effect.itemId as string);
		if (item) item.visible = effect.visible as boolean;
	});

	registry.registerEffect("setItemDescription", (effect, state) => {
		const item = state.items.get(effect.itemId as string);
		if (item) item.description = effect.description as string;
	});

	registry.registerEffect("clearItemContainer", (effect, state) => {
		const item = state.items.get(effect.itemId as string);
		if (item) item.containerId = undefined;
	});

	registry.registerEffect("unlockExit", (effect, state) => {
		const room = state.rooms.get(effect.roomId as string);
		const exit = room?.exits.find((e) => e.direction === effect.direction);
		if (exit) exit.locked = false;
	});

	registry.registerEffect("lockExit", (effect, state) => {
		const room = state.rooms.get(effect.roomId as string);
		const exit = room?.exits.find((e) => e.direction === effect.direction);
		if (exit) exit.locked = true;
	});

	registry.registerEffect("setExitDescription", (effect, state) => {
		const room = state.rooms.get(effect.roomId as string);
		const exit = room?.exits.find((e) => e.direction === effect.direction);
		if (exit) exit.description = effect.description as string;
	});
}

// ---------------------------------------------------------------------------
// Built-in actions
// ---------------------------------------------------------------------------

export function registerBuiltinActions(registry: ActionRegistry): void {
	registry.register(goAction);
	registry.register(lookAction);
	registry.register(examineAction);
	registry.register(takeAction);
	registry.register(dropAction);
	registry.register(useAction);
	registry.register(openAction);
	registry.register(talkAction);
	registry.register(inventoryAction);
	registry.register(helpAction);
	registry.register(quitAction);
	registry.register(respondAction);
}
