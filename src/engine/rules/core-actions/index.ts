import type { ActionRegistry } from "../action-registry";
import type { EventBus } from "../event-bus";
import { registerActionPack, registerActionPacks } from "./helpers";
import { close } from "./items/close";
import { drop } from "./items/drop";
import { examine } from "./items/examine";
import { inventory } from "./items/inventory";
import { lock } from "./items/lock";
import { move } from "./items/move";
import { open } from "./items/open";
import { put } from "./items/put";
import { take } from "./items/take";
import { unlock } from "./items/unlock";
import { use } from "./items/use";
import { enter } from "./navigation/enter";
import { exit } from "./navigation/exit";
import { go } from "./navigation/go";
import { attack } from "./social/attack";
import { respond } from "./social/respond";
import { talk } from "./social/talk";
import { die } from "./system/die";
import { gameEnd } from "./system/game-end";
import { gameStart } from "./system/game-start";
import { help } from "./system/help";
import { look } from "./system/look";
import { quit } from "./system/quit";
import { restoreAction as restore } from "./system/restore";
import { saveAction as save } from "./system/save";
import { tick } from "./system/tick";
import { undo } from "./system/undo";
import { wait } from "./system/wait";
import { again } from "./system/again";
import { restart } from "./system/restart";
import { diagnose } from "./system/diagnose";

export const navigationActions = {
	go,
	enter,
	exit,
} as const;

export const itemActions = {
	take,
	drop,
	put,
	open,
	close,
	unlock,
	lock,
	examine,
	use,
	move,
	inventory,
} as const;

export const socialActions = {
	attack,
	talk,
} as const;

export const systemActions = {
	look,
	help,
	undo,
	save,
	restore,
	quit,
	respond,
	tick,
	"game:start": gameStart,
	"game:end": gameEnd,
	die,
	wait,
	again,
	restart,
	diagnose,
} as const;

export const standardAdventureActions = {
	...navigationActions,
	...itemActions,
	...socialActions,
	...systemActions,
} as const;

/** Alias for backwards compatibility with previous coreActionDefinitions export */
export const coreActionDefinitions = standardAdventureActions;

export type CoreEventName = keyof typeof standardAdventureActions;

export function registerCoreActions(bus: EventBus, registry: ActionRegistry): void {
	registerActionPack(bus, registry, standardAdventureActions);
}

export { registerActionPack, registerActionPacks };
export type { ActionDef, ActionPack } from "./types";
