import { z } from "zod";
import { StructuredOutputSchema } from "../../../agent/types";
import type { CoreEventName } from "../core-actions-types";
import type { ActionDef } from "./types";
import { registerCoreActions as register } from "./types";
import { go } from "./go";
import { take } from "./take";
import { drop } from "./drop";
import { open } from "./open";
import { close } from "./close";
import { unlock } from "./unlock";
import { lock } from "./lock";
import { examine } from "./examine";
import { use } from "./use";
import { move } from "./move";
import { attack } from "./attack";
import { talk } from "./talk";
import { enter } from "./enter";
import { exit } from "./exit";
import { look } from "./look";
import { inventory } from "./inventory";
import { help } from "./help";
import { quit } from "./quit";
import { respond } from "./respond";
import { tick } from "./tick";
import { gameStart } from "./game-start";
import { gameEnd } from "./game-end";
import { die } from "./die";
import type { ActionRegistry } from "../action-registry";
import type { EventBus } from "../event-bus";

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

export type { StoppableEventLike, ActionDef } from "./types";
