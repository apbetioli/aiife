import { dirname, resolve } from "node:path";
import type { LanguageModel } from "ai";
import { GameAgent } from "../agent/GameAgent.js";
import type {
	ActionResult,
	GameState,
	Item,
	NPC,
	Room,
	WorldDefinition,
} from "../types.js";
import {
	ActionRegistry,
	registerBuiltinActions,
	registerBuiltinConditions,
	registerBuiltinEffects,
} from "./ActionRegistry.js";

export class GameEngine {
	private state: GameState;
	private agent: GameAgent;
	private registry: ActionRegistry;

	constructor(
		private definition: WorldDefinition,
		model: LanguageModel,
		private worldFilePath?: string,
	) {
		const rooms = new Map<string, Room>();
		for (const roomDef of definition.rooms) {
			rooms.set(roomDef.id, { ...roomDef });
		}

		const items = new Map<string, Item>();
		for (const item of definition.items) {
			items.set(item.id, { ...item });
		}

		const npcs = new Map<string, NPC>();
		for (const npc of definition.npcs) {
			npcs.set(npc.id, { ...npc });
		}

		const flags = new Map<string, unknown>();
		for (const [key, value] of Object.entries(definition.flags)) {
			flags.set(key, value);
		}

		this.state = {
			rooms,
			items,
			npcs,
			interactions: definition.interactions ?? [],
			currentRoomId: definition.startRoomId,
			inventory: [],
			turnCount: 0,
			gameOver: false,
			flags,
			custom: {},
		};

		// Build registry
		this.registry = new ActionRegistry();
		registerBuiltinConditions(this.registry);
		registerBuiltinEffects(this.registry);
		registerBuiltinActions(this.registry);

		// Register declarative custom actions from world JSON
		for (const custom of definition.customActions ?? []) {
			this.registry.registerCustomAction(custom);
		}

		this.agent = new GameAgent(this.state, model, this.registry);
	}

	async start(): Promise<ActionResult> {
		// Load programmatic actions module if specified
		if (this.definition.actionsModule) {
			const basePath = this.worldFilePath
				? dirname(resolve(this.worldFilePath))
				: process.cwd();
			const modulePath = resolve(basePath, this.definition.actionsModule);
			const mod = await import(modulePath);
			const setup = mod.default ?? mod;
			if (typeof setup === "function") setup(this.registry);
		}

		this.registry.runGameStartHooks(this.state);

		return this.registry.run("look", {}, this.state);
	}

	getState(): GameState {
		return this.state;
	}

	async processInput(input: string): Promise<ActionResult> {
		const trimmed = input.trim();
		if (!trimmed) return { message: "Say something!", success: false };

		const actionMatch = this.registry.parseCommand(trimmed);

		if (!actionMatch) {
			// No exact match — let the agent identify intent and run the action
			return this.agent.processInput(trimmed);
		}

		this.state.turnCount++;

		const result = this.registry.run(
			actionMatch.action,
			actionMatch.params,
			this.state,
		);
		return this.agent.narrateResult(trimmed, actionMatch, result);
	}
}
