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
		provider: process.env[`${prefix}PROVIDER`] ?? "anthropic",
		anthropicModel:
			process.env[`${prefix}ANTHROPIC_MODEL`] ?? "claude-haiku-4-5-20251001",
		openaiModel: process.env[`${prefix}OPENAI_MODEL`] ?? "gpt-4o-mini",
		ollamaModel: process.env[`${prefix}OLLAMA_MODEL`] ?? "llama3.1",
	};
}

function createModelFromConfig(config: ModelConfig): LanguageModel {
	switch (config.provider) {
		case "anthropic":
			return anthropic(config.anthropicModel);
		case "openai":
			return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(
				config.openaiModel,
			);
		case "ollama":
			return createOpenAI({
				baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
				apiKey: "ollama",
			}).chat(config.ollamaModel);
		default:
			throw new Error(`Unknown provider: ${config.provider}`);
	}
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

/** Parser model — fast/cheap, used for intent recognition. Env: LLM_PROVIDER, ANTHROPIC_MODEL, etc. */
export function createParserModel(): LanguageModel {
	return createModelFromConfig(resolveConfig(""));
}

/** Narrator model — used for translation only. Env: NARRATOR_PROVIDER, NARRATOR_ANTHROPIC_MODEL, etc. Falls back to parser model config. */
export function createNarratorModel(): LanguageModel {
	const narratorProvider = process.env.NARRATOR_PROVIDER;
	if (!narratorProvider) return createParserModel();
	return createModelFromConfig(resolveConfig("NARRATOR_"));
}

/** Backwards compat alias. */
export const createModel = createParserModel;

/** Eval model. Env: EVAL_PROVIDER, EVAL_ANTHROPIC_MODEL, etc. */
export function createEvalModel(): LanguageModel {
	return createModelFromConfig(resolveConfig("EVAL_"));
}

export function getEvalModelId(): string {
	return getModelId(resolveConfig("EVAL_"));
}
