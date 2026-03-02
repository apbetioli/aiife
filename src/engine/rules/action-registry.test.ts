import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ActionRegistry, coreActionSchemas } from "./action-registry";

describe("ActionRegistry", () => {
	it("has() returns true for core actions", () => {
		const registry = new ActionRegistry();
		expect(registry.has("go")).toBe(true);
		expect(registry.has("take")).toBe(true);
		expect(registry.has("tick")).toBe(true);
	});

	it("has() returns true for meta actions", () => {
		const registry = new ActionRegistry();
		expect(registry.has("look")).toBe(true);
		expect(registry.has("inventory")).toBe(true);
		expect(registry.has("help")).toBe(true);
		expect(registry.has("quit")).toBe(true);
	});

	it("has() returns false for unknown actions", () => {
		const registry = new ActionRegistry();
		expect(registry.has("fly")).toBe(false);
	});

	it("names() returns all core action names", () => {
		const registry = new ActionRegistry();
		const names = registry.names();
		const expected = Object.keys(coreActionSchemas);
		expect(names).toEqual(expected);
	});

	it("validate() accepts valid params", () => {
		const registry = new ActionRegistry();
		const result = registry.validate("go", { direction: "north" });
		expect(result).toEqual({ direction: "north" });
	});

	it("validate() throws on invalid params", () => {
		const registry = new ActionRegistry();
		expect(() => registry.validate("go", { direction: "sideways" })).toThrow();
	});

	it("validate() throws for unknown action", () => {
		const registry = new ActionRegistry();
		expect(() => registry.validate("fly", {})).toThrow("Unknown action: fly");
	});

	it("safeParse() returns success for valid params", () => {
		const registry = new ActionRegistry();
		const result = registry.safeParse("take", { target: "lamp" });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ target: "lamp" });
		}
	});

	it("safeParse() returns failure for invalid params", () => {
		const registry = new ActionRegistry();
		const result = registry.safeParse("take", {});
		expect(result.success).toBe(false);
	});

	it("safeParse() returns failure for unknown action", () => {
		const registry = new ActionRegistry();
		const result = registry.safeParse("fly", {});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe("Unknown action: fly");
		}
	});

	it("register() adds a custom action", () => {
		const registry = new ActionRegistry();
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
		const registry = new ActionRegistry();
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
		const registry = new ActionRegistry();
		registry.register("pray", {
			schema: z.object({}),
			description: "pray(): Pray.",
		});

		const descriptions = registry.getDescriptions();
		expect(descriptions.pray).toBe("pray(): Pray.");
	});
});
