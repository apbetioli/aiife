import { anthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

interface ModelConfig {
	provider: string;
	anthropicModel: string;
	openaiModel: string;
	ollamaModel: string;
}

function resolveConfig(prefix: string): ModelConfig {
	return {
		provider: process.env[`${prefix}_PROVIDER`] ?? "anthropic",
		anthropicModel: process.env[`${prefix}_ANTHROPIC_MODEL`] ?? "claude-haiku-4-5-20251001",
		openaiModel: process.env[`${prefix}_OPENAI_MODEL`] ?? "gpt-4o-mini",
		ollamaModel: process.env[`${prefix}_OLLAMA_MODEL`] ?? "llama3.1",
	};
}

function createModelFromConfig(config: ModelConfig): LanguageModel {
	switch (config.provider) {
		case "anthropic":
			return anthropic(config.anthropicModel);
		case "openai":
			return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(config.openaiModel);
		case "ollama":
			return createOpenAI({
				baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
				apiKey: "ollama",
			}).chat(config.ollamaModel);
		default:
			throw new Error(`Unknown provider: ${config.provider}`);
	}
}

function createOptionalModel(configPrefix: string): LanguageModel {
	if (!process.env[`${configPrefix}PROVIDER`]) return createParserModel();
	return createModelFromConfig(resolveConfig(configPrefix));
}

function getModelId(config: ModelConfig): string {
	switch (config.provider) {
		case "anthropic":
			return config.anthropicModel;
		case "openai":
			return config.openaiModel;
		case "ollama":
			return config.ollamaModel;
		default:
			return `${config.provider}:unknown`;
	}
}

/** Parser model — fast/cheap, used for intent recognition. Env: INTENT_PROVIDER, ANTHROPIC_MODEL, etc. */
export function createParserModel(): LanguageModel {
	return createModelFromConfig(resolveConfig("INTENT"));
}

/** Narrator model — used for translation only. Env: NARRATOR_PROVIDER, NARRATOR_ANTHROPIC_MODEL, etc. Falls back to parser model config. */
export function createNarratorModel(): LanguageModel {
	return createOptionalModel("NARRATOR_");
}

/** Backwards compat alias. */
export const createModel = createParserModel;

/** Eval model. Env: EVAL_PROVIDER, EVAL_ANTHROPIC_MODEL, etc. */
export function createEvalModel(): LanguageModel {
	return createOptionalModel("EVAL_");
}

export function getEvalModelId(): string {
	return getModelId(resolveConfig("EVAL_"));
}

/** Human-readable summary of which models are configured. For DEBUG logging. */
export function getModelsDebugInfo(): string {
	const parser = resolveConfig("INTENT");
	const hasNarrator = Boolean(process.env.NARRATOR_PROVIDER);
	const narrator = hasNarrator ? resolveConfig("NARRATOR") : parser;
	const hasEval = Boolean(process.env.EVAL_PROVIDER);
	const evalCfg = hasEval ? resolveConfig("EVAL") : null;
	const lines = [
		`parser:  ${parser.provider} / ${getModelId(parser)}`,
		`narrator: ${hasNarrator ? `${narrator.provider} / ${getModelId(narrator)}` : "same as parser"}`,
	];
	if (evalCfg) lines.push(`eval:    ${evalCfg.provider} / ${getModelId(evalCfg)}`);
	return lines.join("\n");
}
