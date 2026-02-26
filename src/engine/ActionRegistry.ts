import { type Tool, tool } from "ai";
import { z } from "zod";
import type {
	ActionResult,
	CustomAction,
	GameState,
	Interaction,
} from "../types.js";
import {
	getCurrentRoom,
	getInventoryItems,
	getRoomNPCs,
	getVisibleItems,
	isItemInInventory,
	isItemInRoom,
	resolveItem,
	resolveNPC,
} from "./ActionValidator.js";
import { goAction } from "./actions/go-action.js";

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

/** Split "the X, the Y and the Z" into ["X", "Y", "Z"], stripping articles. */
function splitItemList(raw: string): string[] {
	return raw
		.split(/\s*(?:,\s*(?:and\s+)?|(?:^|,?\s+)and\s+)\s*/i)
		.map((s) => s.replace(/^(?:the|a|an)\s+/i, "").trim())
		.filter(Boolean);
}

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
	// -- go ----------------------------------------------------------------

	registry.register(goAction);

	// -- look ----------------------------------------------------------------

	registry.register({
		name: "look",
		description: "Look around the current room",
		helpText: "**look** (l) -- Describe your surroundings",
		inputSchema: z.object({}),
		parsePatterns: [{ pattern: /^(look|l)$/, extract: () => ({}) }],
		handler(_params, state) {
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
				message += `\n\n${npcs
					.map((n) => `There is a ${n.name} here.`)
					.join(" ")}`;
			}
			message += `\n\nExits: ${exits.join(", ")}.`;
			return { message, success: true };
		},
	});

	// -- examine -------------------------------------------------------------

	registry.register({
		name: "examine",
		description: "Look closely at an item, NPC, or feature in the current room",
		helpText: "**examine <thing>** (x) -- Look closely at something",
		inputSchema: z.object({
			target: z.string().describe("What to examine"),
		}),
		parsePatterns: [
			{
				pattern: /^(?:examine|ex|x)\s+(.+)$/,
				extract: (m) => ({ target: m[1].trim() }),
			},
			{
				pattern: /^look\s+at\s+(.+)$/,
				extract: (m) => ({ target: m[1].trim() }),
			},
		],
		handler(params, state) {
			const target = params.target as string | undefined;
			if (!target) {
				return { success: false, message: "What do you want to examine?" };
			}

			// Interaction check already ran in the pipeline — if we're here, none matched.
			const item = resolveItem(target, state);
			if (item) return { message: item.description, success: true };

			const npc = resolveNPC(target, state);
			if (npc) return { message: npc.description, success: true };

			return {
				message: `You don't see any "${target}" here.`,
				success: false,
			};
		},
	});

	// -- take ----------------------------------------------------------------

	registry.register({
		name: "take",
		description: "Pick up items from the current room",
		helpText:
			"**take <items>** -- Pick up items (supports 'take all', 'take all but X')",
		inputSchema: z.object({
			items: z.array(z.string()).min(1).describe("Names of items to take"),
		}),
		parsePatterns: [
			// "take all/everything but/except X, Y"
			{
				pattern:
					/^(?:take|get|pick\s+up)\s+(?:all|everything)\s+(?:but|except)\s+(.+)$/,
				extract: (m) => ({
					items: [],
					all: true,
					except: splitItemList(m[1]),
				}),
			},
			// "take all/everything"
			{
				pattern: /^(?:take|get|pick\s+up)\s+(?:all|everything)$/,
				extract: () => ({ items: [], all: true }),
			},
			// "take X, Y and Z" / "get X"
			{
				pattern: /^(?:take|get)\s+(.+)$/,
				extract: (m) => ({ items: splitItemList(m[1]) }),
			},
			// "pick up X, Y and Z"
			{
				pattern: /^pick\s+up\s+(.+)$/,
				extract: (m) => ({ items: splitItemList(m[1]) }),
			},
		],
		handler(params, state, reg) {
			// Expand "all" / "all except" from parser
			let names: string[];
			if (params.all) {
				const visible = getVisibleItems(state).filter(
					(i) =>
						i.traits.includes("portable") && !isItemInInventory(i.id, state),
				);
				const exceptList = (params.except as string[] | undefined) ?? [];
				const exceptLower = exceptList.map((e) => e.toLowerCase());
				names = visible
					.filter((i) => !exceptLower.includes(i.name.toLowerCase()))
					.map((i) => i.name);
				if (names.length === 0) {
					return {
						success: false,
						message: "There's nothing here to take.",
					};
				}
			} else {
				names = params.items as string[];
			}

			if (!names || names.length === 0) {
				return { success: false, message: "What do you want to take?" };
			}

			const messages: string[] = [];
			let anySuccess = false;

			for (const itemName of names) {
				// Per-item interaction check
				const interactionResult = reg.runInteractions(
					"take",
					{ item: itemName, items: [itemName] },
					state,
				);
				if (interactionResult) {
					messages.push(interactionResult.message);
					if (interactionResult.success) anySuccess = true;
					continue;
				}

				const item = resolveItem(itemName, state);
				if (!item) {
					messages.push(`You don't see any "${itemName}" here.`);
					continue;
				}
				if (!item.traits.includes("portable")) {
					messages.push(`You can't pick up the ${item.name}.`);
					continue;
				}
				if (isItemInInventory(item.id, state)) {
					messages.push(`You already have the ${item.name}.`);
					continue;
				}
				if (!isItemInRoom(item.id, state)) {
					messages.push(`The ${item.name} isn't here.`);
					continue;
				}

				const room = getCurrentRoom(state);
				room.itemIds = room.itemIds.filter((id) => id !== item.id);
				state.inventory.push(item.id);
				messages.push(`You pick up the ${item.name}.`);
				anySuccess = true;
			}

			return { message: messages.join("\n"), success: anySuccess };
		},
	});

	// -- drop ----------------------------------------------------------------

	registry.register({
		name: "drop",
		description: "Drop items from inventory into the current room",
		helpText:
			"**drop <items>** -- Put down items (supports 'drop all', 'drop all but X')",
		inputSchema: z.object({
			items: z.array(z.string()).min(1).describe("Names of items to drop"),
		}),
		parsePatterns: [
			// "drop all/everything but/except X, Y"
			{
				pattern:
					/^(?:drop|put\s+down)\s+(?:all|everything)\s+(?:but|except)\s+(.+)$/,
				extract: (m) => ({
					items: [],
					all: true,
					except: splitItemList(m[1]),
				}),
			},
			// "drop all/everything"
			{
				pattern: /^(?:drop|put\s+down)\s+(?:all|everything)$/,
				extract: () => ({ items: [], all: true }),
			},
			// "drop X, Y and Z"
			{
				pattern: /^drop\s+(.+)$/,
				extract: (m) => ({ items: splitItemList(m[1]) }),
			},
			// "put down X, Y and Z"
			{
				pattern: /^put\s+down\s+(.+)$/,
				extract: (m) => ({ items: splitItemList(m[1]) }),
			},
		],
		handler(params, state, reg) {
			// Expand "all" / "all except" from parser
			let names: string[];
			if (params.all) {
				const inv = getInventoryItems(state);
				const exceptList = (params.except as string[] | undefined) ?? [];
				const exceptLower = exceptList.map((e) => e.toLowerCase());
				names = inv
					.filter((i) => !exceptLower.includes(i.name.toLowerCase()))
					.map((i) => i.name);
				if (names.length === 0) {
					return {
						success: false,
						message: "You're not carrying anything to drop.",
					};
				}
			} else {
				names = params.items as string[];
			}

			if (!names || names.length === 0) {
				return { success: false, message: "What do you want to drop?" };
			}

			const messages: string[] = [];
			let anySuccess = false;

			for (const itemName of names) {
				// Per-item interaction check
				const interactionResult = reg.runInteractions(
					"drop",
					{ item: itemName, items: [itemName] },
					state,
				);
				if (interactionResult) {
					messages.push(interactionResult.message);
					if (interactionResult.success) anySuccess = true;
					continue;
				}

				const item = resolveItem(itemName, state);
				if (!item) {
					messages.push(`You don't have any "${itemName}".`);
					continue;
				}
				if (!isItemInInventory(item.id, state)) {
					messages.push(`You don't have the ${item.name}.`);
					continue;
				}

				state.inventory = state.inventory.filter((id) => id !== item.id);
				const room = getCurrentRoom(state);
				room.itemIds.push(item.id);
				messages.push(`You drop the ${item.name}.`);
				anySuccess = true;
			}

			return { message: messages.join("\n"), success: anySuccess };
		},
	});

	// -- use -----------------------------------------------------------------

	registry.register({
		name: "use",
		description: "Use an item from inventory, optionally on a target",
		helpText: "**use <item>** / **use <item> on <target>** -- Use an item",
		inputSchema: z.object({
			items: z.array(z.string()).min(1).describe("Names of items to use"),
			target: z
				.string()
				.optional()
				.describe("Optional target to use the items on"),
		}),
		parsePatterns: [
			{
				pattern: /^use\s+(.+?)\s+on\s+(.+)$/,
				extract: (m) => ({ items: [m[1].trim()], target: m[2].trim() }),
			},
			{
				pattern: /^use\s+(.+)$/,
				extract: (m) => ({ items: [m[1].trim()] }),
			},
		],
		handler(params, state) {
			const items = params.items as string[] | undefined;
			const itemName = items?.[0];
			if (!itemName) {
				return { success: false, message: "What do you want to use?" };
			}

			const item = resolveItem(itemName, state);
			if (!item) {
				return {
					success: false,
					message: `You don't have any "${itemName}".`,
				};
			}
			if (!isItemInInventory(item.id, state)) {
				return {
					success: false,
					message: `You need to pick up the ${item.name} first.`,
				};
			}

			// Interaction check already ran in the pipeline — if we're here, none matched.
			const targetName = params.target as string | undefined;
			return {
				message: `You're not sure how to use the ${item.name}${
					targetName ? ` on the ${targetName}` : ""
				} here.`,
				success: false,
			};
		},
	});

	// -- open ----------------------------------------------------------------

	registry.register({
		name: "open",
		description: "Open a container or door",
		helpText: "**open <thing>** -- Open something",
		inputSchema: z.object({
			target: z.string().describe("What to open"),
		}),
		parsePatterns: [
			{
				pattern: /^open\s+(.+)$/,
				extract: (m) => ({ target: m[1].trim() }),
			},
		],
		handler(params, state) {
			const target = params.target as string | undefined;
			if (!target) {
				return { success: false, message: "What do you want to open?" };
			}

			const room = getCurrentRoom(state);
			const lockedExit = room.exits.find((e) =>
				e.description?.toLowerCase().includes(target.toLowerCase()),
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

			const item = resolveItem(target, state);
			if (!item) {
				return {
					success: false,
					message: `You don't see any "${target}" to open.`,
				};
			}
			if (!item.traits.includes("openable")) {
				return {
					success: false,
					message: `You can't open the ${item.name}.`,
				};
			}

			// Interaction check already ran in the pipeline — if we're here, none matched.
			return {
				success: false,
				message: `You can't open the ${item.name}.`,
			};
		},
	});

	// -- talk ----------------------------------------------------------------

	registry.register({
		name: "talk",
		description: "Talk to an NPC in the current room",
		helpText: "**talk to <person>** -- Speak with someone",
		inputSchema: z.object({
			npc: z.string().describe("Name of the NPC to talk to"),
		}),
		parsePatterns: [
			{
				pattern: /^talk\s+(?:to\s+)?(.+)$/,
				extract: (m) => ({ npc: m[1].trim() }),
			},
			{
				pattern: /^speak\s+(?:to|with)\s+(.+)$/,
				extract: (m) => ({ npc: m[1].trim() }),
			},
		],
		handler(params, state) {
			const npcName = params.npc as string | undefined;
			if (!npcName) {
				return { success: false, message: "Who do you want to talk to?" };
			}

			const npc = resolveNPC(npcName, state);
			if (!npc) {
				return {
					success: false,
					message: `You don't see anyone called "${npcName}" here.`,
				};
			}

			const line = npc.dialogue[npc.dialogueIndex];
			if (npc.dialogueIndex < npc.dialogue.length - 1) {
				npc.dialogueIndex++;
			}
			return { message: line, success: true };
		},
	});

	// -- inventory -----------------------------------------------------------

	registry.register({
		name: "inventory",
		description: "Check what the player is carrying",
		helpText: "**inventory** (i) -- Check what you're carrying",
		inputSchema: z.object({}),
		parsePatterns: [{ pattern: /^(inventory|i|inv)$/, extract: () => ({}) }],
		handler(_params, state) {
			const items = getInventoryItems(state);
			if (items.length === 0) {
				return { message: "You are empty-handed.", success: true };
			}
			const list = items.map((i) => `  - ${i.name}`).join("\n");
			return { message: `You are carrying:\n${list}`, success: true };
		},
	});

	// -- help ----------------------------------------------------------------

	registry.register({
		name: "help",
		description: "Show the list of available commands",
		helpText: "**help** -- Show this message",
		inputSchema: z.object({}),
		parsePatterns: [{ pattern: /^(help|\?)$/, extract: () => ({}) }],
		handler(_params, _state, reg) {
			const lines = reg.getHelpLines();
			return {
				message: `**Available commands:**\n${lines.join("\n")}`,
				success: true,
			};
		},
	});

	// -- quit ----------------------------------------------------------------

	registry.register({
		name: "quit",
		description: "End the game",
		helpText: "**quit** -- End the game",
		inputSchema: z.object({}),
		parsePatterns: [{ pattern: /^(quit|q|exit)$/, extract: () => ({}) }],
		handler(_params, state) {
			state.gameOver = true;
			return {
				message: "Thanks for playing! Goodbye.",
				success: true,
				gameOver: true,
			};
		},
	});

	// -- respond (agent-only, no parse patterns) -----------------------------

	registry.register({
		name: "respond",
		description:
			"Use this instead of a game-action tool when you need to reply without changing game state -- for example to ask a clarifying question, respond to conversational input, or tell the player you don't understand.",
		helpText: "",
		inputSchema: z.object({
			message: z.string().describe("The message to show the player"),
		}),
		parsePatterns: [],
		handler(params) {
			return { success: true, message: (params.message as string) ?? "" };
		},
	});
}
