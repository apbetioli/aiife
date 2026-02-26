import { z } from "zod";
import type { ActionDefinition } from "../ActionRegistry";
import {
	getCurrentRoom,
	getVisibleItems,
	isItemInInventory,
	isItemInRoom,
	resolveItem,
} from "../ActionValidator";
import { splitItemList } from "./parse-utils";

export const takeAction: ActionDefinition = {
	name: "take",
	description: "take(items): Pick up items from the current room. items is an array of item names. For \"take all\", list every visible item.",
	helpText:
		"**take <items>** -- Pick up items (supports 'take all', 'take all but X')",
	inputSchema: z.object({
		items: z.array(z.string()).min(1).describe("Names of items to take"),
	}),
	parsePatterns: [
		{
			pattern:
				/^(?:take|get|pick\s+up)\s+(?:all|everything)\s+(?:but|except)\s+(.+)$/,
			extract: (m) => ({
				items: [],
				all: true,
				except: splitItemList(m[1]),
			}),
		},
		{
			pattern: /^(?:take|get|pick\s+up)\s+(?:all|everything)$/,
			extract: () => ({ items: [], all: true }),
		},
		{
			pattern: /^(?:take|get)\s+(.+)$/,
			extract: (m) => ({ items: splitItemList(m[1]) }),
		},
		{
			pattern: /^pick\s+up\s+(.+)$/,
			extract: (m) => ({ items: splitItemList(m[1]) }),
		},
	],
	handler(params, state, reg) {
		let names: string[];
		if (params.all) {
			const visible = getVisibleItems(state).filter(
				(i) => i.traits.includes("portable") && !isItemInInventory(i.id, state),
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
};
