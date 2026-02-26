import { z } from "zod";
import type { ActionDefinition } from "../ActionRegistry";
import {
	getCurrentRoom,
	getInventoryItems,
	isItemInInventory,
	resolveItem,
} from "../ActionValidator";
import { splitItemList } from "./parse-utils";

export const dropAction: ActionDefinition = {
	name: "drop",
	description: "drop(items): Drop items from inventory. items is an array of item names. For \"drop all\", list every inventory item.",
	helpText:
		"**drop <items>** -- Put down items (supports 'drop all', 'drop all but X')",
	inputSchema: z.object({
		items: z.array(z.string()).min(1).describe("Names of items to drop"),
	}),
	parsePatterns: [
		{
			pattern:
				/^(?:drop|put\s+down)\s+(?:all|everything)\s+(?:but|except)\s+(.+)$/,
			extract: (m) => ({
				items: [],
				all: true,
				except: splitItemList(m[1]),
			}),
		},
		{
			pattern: /^(?:drop|put\s+down)\s+(?:all|everything)$/,
			extract: () => ({ items: [], all: true }),
		},
		{
			pattern: /^drop\s+(.+)$/,
			extract: (m) => ({ items: splitItemList(m[1]) }),
		},
		{
			pattern: /^put\s+down\s+(.+)$/,
			extract: (m) => ({ items: splitItemList(m[1]) }),
		},
	],
	handler(params, state, reg) {
		let names: string[];
		if (params.all) {
			const inv = getInventoryItems(state);
			const exceptList = (params.except as string[] | undefined) ?? [];
			const exceptLower = exceptList.map((e) => e.toLowerCase());
			names = inv
				.filter((i) => !exceptLower.includes(i.name.toLowerCase()))
				.map((i) => i.name);
			if (names.length === 0) {
				return {
					success: false,
					message: "You're not carrying anything to drop.",
				};
			}
		} else {
			names = params.items as string[];
		}

		if (!names || names.length === 0) {
			return { success: false, message: "What do you want to drop?" };
		}

		const messages: string[] = [];
		let anySuccess = false;

		for (const itemName of names) {
			const interactionResult = reg.runInteractions(
				"drop",
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
				messages.push(`You don't have any "${itemName}".`);
				continue;
			}
			if (!isItemInInventory(item.id, state)) {
				messages.push(`You don't have the ${item.name}.`);
				continue;
			}

			state.inventory = state.inventory.filter((id) => id !== item.id);
			const room = getCurrentRoom(state);
			room.itemIds.push(item.id);
			messages.push(`You drop the ${item.name}.`);
			anySuccess = true;
		}

		return { message: messages.join("\n"), success: anySuccess };
	},
};
