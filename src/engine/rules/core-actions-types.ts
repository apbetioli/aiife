/**
 * Core event names. Defined here (without importing core-actions) so that types.ts
 * can depend on this file and core-actions can depend on event-bus and executor
 * without a circular dependency.
 *
 * When adding a new core action, add its name here and to coreActionDefinitions
 * in core-actions.ts. Param types are inferred from each action's zod schema at
 * runtime (validation) and are not duplicated here.
 */

export type CoreEventName =
	| "go"
	| "take"
	| "drop"
	| "open"
	| "close"
	| "unlock"
	| "lock"
	| "examine"
	| "use"
	| "move"
	| "attack"
	| "talk"
	| "enter"
	| "exit"
	| "look"
	| "inventory"
	| "help"
	| "quit"
	| "respond"
	| "tick"
	| "game:start"
	| "game:end"
	| "die";
