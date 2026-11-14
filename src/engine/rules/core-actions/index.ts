import { isInInventory, setObjectState } from "../../mutators";
import type { ActionRegistry } from "../action-registry";
import type { EventBus } from "../event-bus";
import { getObjectIds } from "../param-helpers";
import { PRIORITY } from "../priorities";
import { registerActionPack, registerActionPacks } from "./helpers";
import { blow } from "./items/blow";
import { breakAction as breakVerb } from "./items/break";
import { burn } from "./items/burn";
import { close } from "./items/close";
import { drop } from "./items/drop";
import { examine } from "./items/examine";
import { give } from "./items/give";
import { inventory } from "./items/inventory";
import { lock } from "./items/lock";
import { move } from "./items/move";
import { open } from "./items/open";
import { put } from "./items/put";
import { take } from "./items/take";
import { throwAction as throwVerb } from "./items/throw";
import { turnOff } from "./items/turn-off";
import { turnOn } from "./items/turn-on";
import { unlock } from "./items/unlock";
import { use } from "./items/use";
import { enter } from "./navigation/enter";
import { exit } from "./navigation/exit";
import { go } from "./navigation/go";
import { attack } from "./social/attack";
import { respond } from "./social/respond";
import { talk } from "./social/talk";
import { again } from "./system/again";
import { brief } from "./system/brief";
import { diagnose } from "./system/diagnose";
import { die } from "./system/die";
import { gameEnd } from "./system/game-end";
import { gameStart } from "./system/game-start";
import { help } from "./system/help";
import { look } from "./system/look";
import { quit } from "./system/quit";
import { restart } from "./system/restart";
import { restoreAction as restore } from "./system/restore";
import { saveAction as save } from "./system/save";
import { score } from "./system/score";
import { superbrief } from "./system/superbrief";
import { tick } from "./system/tick";
import { undo } from "./system/undo";
import { verbose } from "./system/verbose";
import { wait } from "./system/wait";

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
	break: breakVerb,
	burn,
	throw: throwVerb,
	give,
	blow,
	turn_on: turnOn,
	turn_off: turnOff,
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
	score,
	brief,
	superbrief,
	verbose,
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
	bus.on(
		"take",
		(event, state) => {
			const ids = getObjectIds(event.params as Record<string, unknown>);
			for (const id of ids) {
				if (isInInventory(state, id)) {
					setObjectState(state, id, "takenOnce", true);
				}
			}
		},
		{ priority: PRIORITY.POST_MUTATION },
	);
}

export { registerActionPack, registerActionPacks };
export type { ActionDef, ActionPack } from "./types";
