import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ActionRegistry } from "./action-registry";
import { coreActionDefinitions, registerCoreActions } from "./core-actions";
import { EventBus } from "./event-bus";

function createRegistryWithCoreActions(): ActionRegistry {
	const bus = new EventBus();
	const registry = new ActionRegistry();
	registerCoreActions(bus, registry);
	return registry;
}

describe("ActionRegistry", () => {
	it("has() returns true for core actions", () => {
		const registry = createRegistryWithCoreActions();
		expect(registry.has("go")).toBe(true);
		expect(registry.has("take")).toBe(true);
		expect(registry.has("tick")).toBe(true);
	});

	it("has() returns true for meta actions", () => {
		const registry = createRegistryWithCoreActions();
		expect(registry.has("look")).toBe(true);
		expect(registry.has("inventory")).toBe(true);
		expect(registry.has("help")).toBe(true);
		expect(registry.has("quit")).toBe(true);
	});

	it("has() returns false for unknown actions", () => {
		const registry = createRegistryWithCoreActions();
		expect(registry.has("fly")).toBe(false);
	});

	it("names() returns all core action names (drift check: registry stays in sync with core definitions)", () => {
		const registry = createRegistryWithCoreActions();
		const names = registry.names();
		const expected = Object.keys(coreActionDefinitions);
		expect(names).toEqual(expected);
	});

	it("validate() accepts valid params", () => {
		const registry = createRegistryWithCoreActions();
		const result = registry.validate("go", { direction: "north" });
		expect(result).toEqual({ direction: "north" });
	});

	it("validate() throws on invalid params", () => {
		const registry = createRegistryWithCoreActions();
		expect(() => registry.validate("go", { direction: "sideways" })).toThrow();
	});

	it("validate() throws for unknown action", () => {
		const registry = createRegistryWithCoreActions();
		expect(() => registry.validate("fly", {})).toThrow("Unknown action: fly");
	});

	it("safeParse() returns success for valid params", () => {
		const registry = createRegistryWithCoreActions();
		const result = registry.safeParse("take", { objects: ["lamp"] });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ objects: ["lamp"] });
		}
	});

	it("safeParse() returns failure for invalid params", () => {
		const registry = createRegistryWithCoreActions();
		const result = registry.safeParse("take", {});
		expect(result.success).toBe(false);
	});

	it("safeParse() returns failure for unknown action", () => {
		const registry = createRegistryWithCoreActions();
		const result = registry.safeParse("fly", {});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe("Unknown action: fly");
		}
	});

	it("register() adds a custom action", () => {
		const registry = createRegistryWithCoreActions();
		const praySchema = z.object({ target: z.string().optional() });

		registry.register("pray", {
			schema: praySchema,
			description: "pray(target?): Pray to a deity or at a shrine.",
		});

		expect(registry.has("pray")).toBe(true);
		expect(registry.names()).toContain("pray");

		const result = registry.safeParse("pray", { target: "altar" });
		expect(result.success).toBe(true);

		const result2 = registry.safeParse("pray", {});
		expect(result2.success).toBe(true);
	});

	it("getDescriptions() excludes empty descriptions (internal events)", () => {
		const registry = createRegistryWithCoreActions();
		const descriptions = registry.getDescriptions();

		// Internal events have empty descriptions
		expect(descriptions).not.toHaveProperty("tick");
		expect(descriptions).not.toHaveProperty("game:start");
		expect(descriptions).not.toHaveProperty("game:end");
		expect(descriptions).not.toHaveProperty("enter");
		expect(descriptions).not.toHaveProperty("exit");

		// Bus actions have descriptions
		expect(descriptions).toHaveProperty("go");
		expect(descriptions).toHaveProperty("take");
		expect(descriptions).toHaveProperty("examine");

		// Meta actions have descriptions
		expect(descriptions).toHaveProperty("look");
		expect(descriptions).toHaveProperty("inventory");
		expect(descriptions).toHaveProperty("help");
		expect(descriptions).toHaveProperty("quit");
		expect(descriptions.look).toBeTruthy();
		expect(descriptions.inventory).toBeTruthy();
		expect(descriptions.help).toBeTruthy();
		expect(descriptions.quit).toBeTruthy();
	});

	it("getDescriptions() includes custom action descriptions", () => {
		const registry = createRegistryWithCoreActions();
		registry.register("pray", {
			schema: z.object({}),
			description: "pray(): Pray.",
		});

		const descriptions = registry.getDescriptions();
		expect(descriptions.pray).toBe("pray(): Pray.");
	});
});
