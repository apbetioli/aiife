import type { z } from "zod";
import { StructuredOutputSchema } from "../../../agent/types";
import type { ActionRegistry } from "../action-registry";
import type { CoreEventName } from "../core-actions-types";
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

// Ensure we have an entry for every CoreEventName (compile-time check when adding new actions).
const _coreKeysCheck: Record<CoreEventName, (typeof coreActionDefinitions)[CoreEventName]> = coreActionDefinitions;
void _coreKeysCheck;

// Runtime drift check: player-facing action param fields must exist on StructuredOutputSchema.
(function assertParserSchemaCoversActions() {
	const parserKeys = new Set(Object.keys(StructuredOutputSchema.shape));
	for (const [name, entry] of Object.entries(coreActionDefinitions)) {
		if (!entry.description) continue;
		for (const key of Object.keys((entry.schema as z.ZodObject<z.ZodRawShape>).shape)) {
			if (!parserKeys.has(key)) {
				throw new Error(
					`StructuredOutputSchema is missing field "${key}" from action "${name}". Add it as a nullable field.`,
				);
			}
		}
	}
})();

export function registerCoreActions(bus: EventBus, registry: ActionRegistry): void {
	register(bus, registry, coreActionDefinitions as unknown as Record<string, ActionDef<unknown>>);
}

export type { ActionDef, StoppableEventLike } from "./types";
