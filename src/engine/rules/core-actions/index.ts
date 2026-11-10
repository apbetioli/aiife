import type { ActionRegistry } from "../action-registry";
import type { EventBus } from "../event-bus";
import { registerCoreActions as register } from "./helpers";
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
import type { ActionDef } from "./types";

export const coreActionDefinitions = {
	go,
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
	attack,
	talk,
	enter,
	exit,
	look,
	inventory,
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
} as const;

export type CoreEventName = keyof typeof coreActionDefinitions;

export function registerCoreActions(bus: EventBus, registry: ActionRegistry): void {
	register(bus, registry, coreActionDefinitions as unknown as Record<string, ActionDef<unknown>>);
}

export type { ActionDef, IntentMeta } from "./types";
