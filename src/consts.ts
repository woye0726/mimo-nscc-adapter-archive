import type { ModelDefinition } from './types';

/**
 * Compile-time constants shared across the extension.
 *
 * These do NOT depend on the VS Code runtime (no workspace configuration,
 * no secrets API). For run-time settings reads see `config.ts`.
 */

/** VS Code configuration section prefix for all extension settings. */
export const CONFIG_SECTION = 'mimo-nscc';

// ---- Secret keys ----

/** SecretStorage key for the MiMo API key. */
export const MIMO_API_KEY_SECRET = 'mimo-nscc.mimoApiKey';

/** SecretStorage key for the NSCC API key. */
export const NSCC_API_KEY_SECRET = 'mimo-nscc.nsccApiKey';

/** memento key tracking whether the welcome walkthrough has been shown. */
export const WELCOME_SHOWN_KEY = 'mimo-nscc.welcomeShown';

// ---- Walkthrough ----

/** Walkthrough contribution ID. */
export const WALKTHROUGH_ID = 'mimo-user.mimo-nscc-adapter#mimoNsccGettingStarted';

// ---- Model picker ----

/** Detail text shown in the model picker when no API key is configured. */
export const API_KEY_REQUIRED_DETAIL = 'Please run MiMo-NSCC: Set API Key to configure.';

/** Per-model configuration schema consumed by Copilot Chat's model picker. */
export const THINKING_EFFORT_CONFIGURATION_SCHEMA = {
	properties: {
		reasoningEffort: {
			type: 'string',
			title: 'Thinking Effort',
			enum: ['none', 'high', 'max'],
			enumItemLabels: ['None', 'High', 'Max'],
			enumDescriptions: [
				'Disable thinking for faster responses',
				'Recommended for most tasks',
				'Maximum reasoning depth for complex agent tasks',
			],
			default: 'high',
			group: 'navigation',
		},
	},
} as const;

// ---- Vision proxy ----

/**
 * Default model ID used for the vision proxy when auto-detection is enabled.
 * Uses a widely available Copilot model; users can override via settings.
 */
export const DEFAULT_VISION_MODEL_ID = 'gpt-4o';

/**
 * Prompt sent to the vision proxy model when describing image attachments
 * before forwarding them to text-only models.
 */
export const IMAGE_DESCRIPTION_PROMPT =
	'Describe the visual contents of this image in detail, including any text, objects, people, or context that would be relevant for understanding it. Focus on factual visual elements.';

// ---- Cache ----

/** Max entries in the reasoning-content cache before eviction kicks in. */
export const MAX_CACHE_SIZE = 200;

// ---- API format ----

/** Which API format a model family uses. */
export type ApiFormat = 'openai' | 'anthropic';

// ---- System prompts ----

/** MiMo system prompt — Chinese version (recommended by MiMo docs). */
export const MIMO_SYSTEM_PROMPT_ZH = `你是MiMo（中文名称也是MiMo），是小米公司研发的AI智能助手。
今天的日期：{date} {week}，你的知识截止日期是2024年12月。`;

/** MiMo system prompt — English version. */
export const MIMO_SYSTEM_PROMPT_EN = `You are MiMo, an AI assistant developed by Xiaomi.
Today's date: {date} {week}. Your knowledge cutoff date is December 2024.`;

// ---- Model registry ----

/**
 * All registered models — MiMo (Xiaomi) and NSCC families always visible.
 *
 * Model IDs, names, and factual descriptions are sourced from
 * Xiaomi MiMo official docs (model releases, model-hyperparameters).
 *
 * MiMo models use OpenAI protocol (api-key header + /v1/chat/completions).
 * NSCC Qwen3.5 uses Anthropic protocol (x-api-key + /v1/messages + SSE events).
 */
export const MODELS: ModelDefinition[] = [
	// ============================================================
	//  MiMo V2.5 系列  (2026-04-23 公测)
	// ============================================================
	{
		id: 'mimo-v2.5-pro',
		name: 'MiMo V2.5 Pro',
		family: 'mimo',
		apiFormat: 'openai',
		version: 'v2.5',
		detail:
			'Flagship agent model — 1T/42B, 1M ctx. Competes with Claude Opus 4.6 / GPT‑5.4. Built for hard agent workloads: multi‑hundred tool‑call sessions, complex software engineering.',
		maxInputTokens: 1048576,
		maxOutputTokens: 16384,
		capabilities: {
			toolCalling: true,
			imageInput: false,
			thinking: true,
		},
		requiresThinkingParam: true,
	},
	{
		id: 'mimo-v2.5',
		name: 'MiMo V2.5',
		family: 'mimo',
		apiFormat: 'openai',
		version: 'v2.5',
		detail:
			'Native multimodal agent — image, video, audio, text. 1M ctx. 50% cheaper than V2.5 Pro. Best for everyday agent tasks and multimodal reasoning.',
		maxInputTokens: 1048576,
		maxOutputTokens: 16384,
		capabilities: {
			toolCalling: true,
			imageInput: true,
			thinking: true,
		},
		requiresThinkingParam: true,
	},
	// ============================================================
	//  MiMo V2 系列
	// ============================================================
	{
		id: 'mimo-v2-pro',
		name: 'MiMo V2 Pro',
		family: 'mimo',
		apiFormat: 'openai',
		version: 'v2',
		detail:
			'Previous flagship — 1T/42B, 1M ctx. Hybrid attention (1:7 Global/SWA). Solid agent baseline at GPT‑4.5 class.',
		maxInputTokens: 1048576,
		maxOutputTokens: 16384,
		capabilities: {
			toolCalling: true,
			imageInput: false,
			thinking: true,
		},
		requiresThinkingParam: true,
	},
	{
		id: 'mimo-v2-omni',
		name: 'MiMo V2 Omni',
		family: 'mimo',
		apiFormat: 'openai',
		version: 'v2',
		detail:
			'Multimodal — text, vision, speech. 256K ctx. Native image understanding (no proxy needed). Good for visual reasoning tasks.',
		maxInputTokens: 262144,
		maxOutputTokens: 16384,
		capabilities: {
			toolCalling: true,
			imageInput: true,
			thinking: true,
		},
		requiresThinkingParam: true,
	},
	{
		id: 'mimo-v2-flash',
		name: 'MiMo V2 Flash',
		family: 'mimo',
		apiFormat: 'openai',
		version: 'v2',
		detail:
			'Fast & efficient — SWA 128 window, 2.5–3.7× inference speedup. 97% tool‑call success rate in Thinking mode. Best for quick edits, cheap iteration.',
		maxInputTokens: 1048576,
		maxOutputTokens: 16384,
		capabilities: {
			toolCalling: true,
			imageInput: false,
			thinking: true,
		},
		requiresThinkingParam: true,
	},
	// ============================================================
	//  NSCC 系列  (Anthropic 协议)
	// ============================================================
	{
		id: 'Qwen3.5',
		name: 'Qwen3.5 (NSCC)',
		family: 'nscc',
		apiFormat: 'anthropic',
		version: '3.5',
		detail:
			'NSCC Qwen3.5 via Anthropic API — 国家超算长沙中心. Use x-api-key auth, content‑block SSE streaming.',
		maxInputTokens: 131072,
		maxOutputTokens: 16384,
		capabilities: {
			toolCalling: true,
			imageInput: false,
			thinking: true,
		},
		requiresThinkingParam: true,
	},
];
