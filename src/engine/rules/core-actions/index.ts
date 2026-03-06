import type { ActionRegistry } from "../action-registry";
import type { EventBus } from "../event-bus";
import { attack } from "./attack";
import { close } from "./close";
import { die } from "./die";
import { drop } from "./drop";
import { enter } from "./enter";
import { examine } from "./examine";
import { exit } from "./exit";
import { gameEnd } from "./game-end";
import { gameStart } from "./game-start";
import { go } from "./go";
import { help } from "./help";
import { inventory } from "./inventory";
import { lock } from "./lock";
import { look } from "./look";
import { move } from "./move";
import { open } from "./open";
import { quit } from "./quit";
import { respond } from "./respond";
import { take } from "./take";
import { talk } from "./talk";
import { tick } from "./tick";
import type { ActionDef } from "./types";
import { registerCoreActions as register } from "./types";
import { unlock } from "./unlock";
import { use } from "./use";

export const coreActionDefinitions = {
	go,
	take,
	drop,
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

export type { ActionDef, StoppableEventLike } from "./types";
