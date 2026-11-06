import type { GameSetup } from "../engine/rules";
import type { World } from "./types";

export interface GameDefinition {
	world: World;
	setup?: GameSetup;
}

/**
 * Type-safe helper to define a game.
 *
 * Provides IDE autocomplete for `world` and `setup`, and infers the types of
 * `(bus, registry)` inside `setup` automatically.
 *
 * Also accepts a bare `World` object for games without custom setup logic.
 */
export type DefinedGame<T extends GameDefinition> = T extends { setup: GameSetup }
	? { world: T["world"]; setup: GameSetup }
	: { world: T["world"]; setup?: GameSetup };

/**
 * Type-safe helper to define a game.
 *
 * Provides IDE autocomplete for `world` and `setup`, and infers the types of
 * `(bus, registry)` inside `setup` automatically.
 *
 * Also accepts a bare `World` object for games without custom setup logic.
 */
export function defineGame<T extends GameDefinition>(definition: T): DefinedGame<T>;
export function defineGame(world: World): { world: World; setup?: GameSetup };
export function defineGame(definition: GameDefinition | World): GameDefinition {
	if ("world" in definition && definition.world != null) {
		return definition;
	}
	return { world: definition as World };
}
