import vscode from 'vscode';
import { AuthManager } from '../auth';
import { MiMoNSCCClient } from '../client';
import { getApiModelId, getBaseUrl, getMaxTokens, type ModelFamily } from '../config';
import {
    API_KEY_REQUIRED_DETAIL,
    CONFIG_SECTION,
    MIMO_SYSTEM_PROMPT_EN,
    MODELS,
    THINKING_EFFORT_CONFIGURATION_SCHEMA,
} from '../consts';
import { logger } from '../logger';
import type { ModelDefinition, OpenAIToolCall } from '../types';
import { pruneReasoningCache, type ReasoningEntry } from './cache';
import {
    convertToAnthropicMessages,
    convertToAnthropicTools,
    convertToOpenAIMessages,
    convertToOpenAITools,
    countOpenAIMessageChars,
} from './convert';
import { createVisionModelGetter, resolveImageMessages, setVisionProxyModel } from './vision';

/**
 * NOTE: Non-public API surface.
 *
 * The fields below (`configurationSchema` on chat info, `modelConfiguration`
 * on response options, plus `isUserSelectable` / `statusIcon`) are not part
 * of the stable `vscode.LanguageModelChat*` typings yet. They are the same
 * shape currently consumed by GitHub Copilot Chat to render a per-model
 * config dropdown in the model picker (see Copilot Chat's built-in
 * providers, e.g. its OpenAI/Anthropic providers using `reasoningEffort`).
 *
 * If/when VS Code stabilizes these as proposed API, switch to the official
 * types and drop the casts below.
 */

type ThinkingEffort = 'none' | 'high' | 'max';

type ModelConfigurationOptions = vscode.ProvideLanguageModelChatResponseOptions & {
	readonly modelConfiguration?: Record<string, unknown>;
	readonly configuration?: Record<string, unknown>;
};

type ModelPickerChatInformation = vscode.LanguageModelChatInformation & {
	readonly isUserSelectable: boolean;
	readonly statusIcon?: vscode.ThemeIcon;
	readonly configurationSchema?: typeof THINKING_EFFORT_CONFIGURATION_SCHEMA;
};

/**
 * MiMo-NSCC Chat Provider — implements vscode.LanguageModelChatProvider so
 * MiMo (OpenAI format) and NSCC (Anthropic format) models appear directly
 * in the Copilot Chat model picker.
 *
 * Both model families are always visible. Each family uses its own API key,
 * base URL, and request format. The provider resolves the correct credentials
 * at request time based on the model's family.
 */
export class MiMoNSCCChatProvider implements vscode.LanguageModelChatProvider {
	private readonly authManager: AuthManager;
	private readonly onDidChangeLanguageModelChatInformationEmitter = new vscode.EventEmitter<void>();
	private isActive = true;

	readonly onDidChangeLanguageModelChatInformation =
		this.onDidChangeLanguageModelChatInformationEmitter.event;

	/** reasoning text → tool_call IDs cache (used for OpenAI-format multi-turn). */
	private readonly reasoningCache = new Map<string, ReasoningEntry>();

	/** Vision proxy: resolver + cached model. */
	private readonly vision = createVisionModelGetter();

	/** Adaptive chars-per-token ratio, calibrated from actual usage data. */
	private charsPerToken = 4.0;

	constructor(context: vscode.ExtensionContext) {
		this.authManager = new AuthManager(context);

		context.subscriptions.push(
			this.onDidChangeLanguageModelChatInformationEmitter,
			// Fire refresh when any API key or vision setting changes.
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (
					e.affectsConfiguration(`${CONFIG_SECTION}.mimoApiKey`) ||
					e.affectsConfiguration(`${CONFIG_SECTION}.nsccApiKey`)
				) {
					this.onDidChangeLanguageModelChatInformationEmitter.fire();
				}
				if (
					e.affectsConfiguration(`${CONFIG_SECTION}.visionModel`) ||
					e.affectsConfiguration(`${CONFIG_SECTION}.visionFallbackIds`)
				) {
					this.vision.reset();
				}
			}),
			// Multi-window sync: SecretStorage changes for either key.
			context.secrets.onDidChange((e) => {
				if (
					e.key === `${CONFIG_SECTION}.mimoApiKey` ||
					e.key === `${CONFIG_SECTION}.nsccApiKey`
				) {
					this.onDidChangeLanguageModelChatInformationEmitter.fire();
				}
			}),
		);
	}

	// ---- Public commands ----

	async configureMimoApiKey(): Promise<void> {
		const saved = await this.authManager.promptForMimoApiKey();
		if (saved) this.onDidChangeLanguageModelChatInformationEmitter.fire();
	}

	async configureNsccApiKey(): Promise<void> {
		const saved = await this.authManager.promptForNsccApiKey();
		if (saved) this.onDidChangeLanguageModelChatInformationEmitter.fire();
	}

	async clearMimoApiKey(): Promise<void> {
		await this.authManager.deleteApiKey('mimo');
		this.onDidChangeLanguageModelChatInformationEmitter.fire();
		vscode.window.showInformationMessage('MiMo API key removed.');
	}

	async clearNsccApiKey(): Promise<void> {
		await this.authManager.deleteApiKey('nscc');
		this.onDidChangeLanguageModelChatInformationEmitter.fire();
		vscode.window.showInformationMessage('NSCC API key removed.');
	}

	async hasAnyApiKey(): Promise<boolean> {
		return this.authManager.hasAnyApiKey();
	}

	async prepareForDeactivate(): Promise<void> {
		this.isActive = false;
		this.onDidChangeLanguageModelChatInformationEmitter.fire();
		try {
			await vscode.lm.selectChatModels({ vendor: 'mimo-nscc' });
		} catch (error) {
			logger.warn('Failed to refresh MiMo-NSCC models during deactivate', error);
		}
	}

	async setVisionProxyModel(): Promise<void> {
		await setVisionProxyModel();
	}

	// ---- LanguageModelChatProvider ----

	async provideLanguageModelChatInformation(
		_options: vscode.PrepareLanguageModelChatModelOptions,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelChatInformation[]> {
		if (!this.isActive) return [];

		// Show ALL models — both MiMo and NSCC. Each model's warning state
		// is keyed to whether its family has an API key configured.
		const mimoHasKey = await this.authManager.hasApiKey('mimo');
		const nsccHasKey = await this.authManager.hasApiKey('nscc');

		return MODELS.map((model) => {
			const familyHasKey = model.family === 'nscc' ? nsccHasKey : mimoHasKey;
			return toChatInfo(model, familyHasKey);
		});
	}

	async provideLanguageModelChatResponse(
		modelInfo: vscode.LanguageModelChatInformation,
		messages: readonly vscode.LanguageModelChatRequestMessage[],
		options: vscode.ProvideLanguageModelChatResponseOptions,
		progress: vscode.Progress<vscode.LanguageModelResponsePart>,
		token: vscode.CancellationToken,
	): Promise<void> {
		const modelDef = MODELS.find((m) => m.id === modelInfo.id);
		if (!modelDef) {
			throw new Error(`Unknown model: ${modelInfo.id}`);
		}

		const family: ModelFamily = modelDef.family === 'nscc' ? 'nscc' : 'mimo';

		// Resolve credentials per family
		const apiKey = await this.authManager.getApiKey(family);
		if (!apiKey) {
			const label = family === 'nscc' ? 'NSCC' : 'MiMo';
			throw new Error(
				`${label} API key not configured. Run "MiMo-NSCC: Set ${label} API Key" from the Command Palette.`,
			);
		}

		const baseUrl = getBaseUrl(family);
		const client = new MiMoNSCCClient(baseUrl, apiKey, modelDef.apiFormat, family);

		const isThinkingModel = modelDef.capabilities.thinking;
		const thinkingEffort = getConfiguredThinkingEffort(options as ModelConfigurationOptions);
		const maxTokens = getMaxTokens();

		// Heuristic: clear stale cache on new conversations
		if (messages.length <= 2) {
			pruneReasoningCache(this.reasoningCache, true);
		}

		// Vision proxy
		const resolvedMessages = await resolveImageMessages(messages, token, () => this.vision.get());

		// Route to format-specific handler
		if (modelDef.apiFormat === 'anthropic') {
			return this._handleAnthropicRequest(
				client, modelDef, resolvedMessages, options, progress, token,
				isThinkingModel, thinkingEffort, maxTokens,
			);
		}

		return this._handleOpenAIRequest(
			client, modelInfo, modelDef, resolvedMessages, options, progress, token,
			isThinkingModel, thinkingEffort, maxTokens,
		);
	}

	// ---- OpenAI-format handler (MiMo) ----

	private _handleOpenAIRequest(
		client: MiMoNSCCClient,
		modelInfo: vscode.LanguageModelChatInformation,
		modelDef: ModelDefinition,
		messages: readonly vscode.LanguageModelChatRequestMessage[],
		options: vscode.ProvideLanguageModelChatResponseOptions,
		progress: vscode.Progress<vscode.LanguageModelResponsePart>,
		token: vscode.CancellationToken,
		isThinkingModel: boolean,
		thinkingEffort: ThinkingEffort,
		maxTokens: number | undefined,
	): Promise<void> {
		const openaiMessages = convertToOpenAIMessages(messages, isThinkingModel, this.reasoningCache);
		const tools = modelDef.capabilities.toolCalling ? convertToOpenAITools(options.tools) : undefined;
		const totalRequestChars = countOpenAIMessageChars(openaiMessages);

		let accumulatedReasoning = '';
		const pendingToolCallIds: string[] = [];
		let responseMessageId: string | undefined;

		return new Promise<void>((resolve, reject) => {
			client.streamChatCompletion(
				{
					model: getApiModelId('mimo', modelInfo.id),
					messages: openaiMessages,
					stream: true,
					tools,
					tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
					max_tokens: maxTokens,
					...(isThinkingModel
						? {
								thinking: {
									type: thinkingEffort === 'none' ? ('disabled' as const) : ('enabled' as const),
								},
								...(thinkingEffort === 'none' ? {} : { reasoning_effort: thinkingEffort }),
							}
						: {}),
				},
				{
					onContent: (content: string) => {
						progress.report(new vscode.LanguageModelTextPart(content));
					},
					onThinking: (text: string) => {
						accumulatedReasoning += text;
						progress.report(
							new vscode.LanguageModelThinkingPart(text) as unknown as vscode.LanguageModelResponsePart,
						);
					},
					onToolCall: (toolCall: OpenAIToolCall) => {
						pendingToolCallIds.push(toolCall.id);
						if (isThinkingModel && accumulatedReasoning) {
							this.reasoningCache.set(toolCall.id, {
								text: accumulatedReasoning,
								timestamp: Date.now(),
							});
						}
						try {
							const args = JSON.parse(toolCall.function.arguments);
							progress.report(
								new vscode.LanguageModelToolCallPart(toolCall.id, toolCall.function.name, args),
							);
						} catch {
							progress.report(
								new vscode.LanguageModelToolCallPart(toolCall.id, toolCall.function.name, {}),
							);
						}
					},
					onError: (error: Error) => reject(error),
					onDone: () => {
						if (isThinkingModel && accumulatedReasoning && pendingToolCallIds.length === 0) {
							responseMessageId = `resp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
							this.reasoningCache.set(responseMessageId, {
								text: accumulatedReasoning,
								timestamp: Date.now(),
							});
						}
						pruneReasoningCache(this.reasoningCache, false);
						resolve();
					},
					onUsage: (usage) => {
						if (totalRequestChars > 0 && usage.prompt_tokens > 0) {
							const observedRatio = totalRequestChars / usage.prompt_tokens;
							this.charsPerToken = this.charsPerToken * 0.7 + observedRatio * 0.3;
						}
						const cacheHit = usage.prompt_cache_hit_tokens ?? 0;
						const cacheMiss = usage.prompt_cache_miss_tokens ?? 0;
						const cacheTotal = cacheHit + cacheMiss;
						const hitRate = cacheTotal > 0 ? ((cacheHit / cacheTotal) * 100).toFixed(0) : 'n/a';
						logger.info(
							`tokens: prompt=${usage.prompt_tokens} completion=${usage.completion_tokens}` +
								` | cache: hit=${cacheHit} miss=${cacheMiss} rate=${hitRate}%` +
								` | chars/tok=${this.charsPerToken.toFixed(2)}`,
						);
					},
				},
				token,
			);
		});
	}

	// ---- Anthropic-format handler (NSCC) ----

	private _handleAnthropicRequest(
		client: MiMoNSCCClient,
		modelDef: ModelDefinition,
		messages: readonly vscode.LanguageModelChatRequestMessage[],
		options: vscode.ProvideLanguageModelChatResponseOptions,
		progress: vscode.Progress<vscode.LanguageModelResponsePart>,
		token: vscode.CancellationToken,
		isThinkingModel: boolean,
		thinkingEffort: ThinkingEffort,
		maxTokens: number | undefined,
	): Promise<void> {
		const anthropicMessages = convertToAnthropicMessages(messages);
		const anthropicTools = modelDef.capabilities.toolCalling
			? convertToAnthropicTools(options.tools)
			: undefined;

		const systemPrompt = MIMO_SYSTEM_PROMPT_EN;

		let accumulatedReasoning = '';
		const pendingToolCallIds: string[] = [];

		return new Promise<void>((resolve, reject) => {
			client.streamChatCompletion(
				{
					model: getApiModelId('nscc', modelDef.id),
					messages: anthropicMessages,
					system: systemPrompt,
					max_tokens: maxTokens ?? 16384,
					stream: true,
					tools: anthropicTools,
					...(isThinkingModel && thinkingEffort !== 'none'
						? { thinking: { type: 'enabled' as const, budget_tokens: 4096 } }
						: { thinking: { type: 'disabled' as const } }),
				},
				{
					onContent: (content: string) => {
						progress.report(new vscode.LanguageModelTextPart(content));
					},
					onThinking: (text: string) => {
						accumulatedReasoning += text;
						progress.report(
							new vscode.LanguageModelThinkingPart(text) as unknown as vscode.LanguageModelResponsePart,
						);
					},
					onToolCall: (toolCall: OpenAIToolCall) => {
						pendingToolCallIds.push(toolCall.id);
						try {
							const args = JSON.parse(toolCall.function.arguments);
							progress.report(
								new vscode.LanguageModelToolCallPart(toolCall.id, toolCall.function.name, args),
							);
						} catch {
							progress.report(
								new vscode.LanguageModelToolCallPart(toolCall.id, toolCall.function.name, {}),
							);
						}
					},
					onError: (error: Error) => reject(error),
					onDone: () => resolve(),
					onUsage: (usage) => {
						logger.info(
							`tokens: prompt=${usage.prompt_tokens} completion=${usage.completion_tokens}`,
						);
					},
				},
				token,
			);
		});
	}

	async provideTokenCount(
		_modelInfo: vscode.LanguageModelChatInformation,
		text: string | vscode.LanguageModelChatRequestMessage,
		_token: vscode.CancellationToken,
	): Promise<number> {
		if (typeof text === 'string') {
			return Math.max(1, Math.ceil(text.length / this.charsPerToken));
		}
		if (!text?.content || !Array.isArray(text.content)) return 1;
		let total = 0;
		for (const part of text.content) {
			if (part instanceof vscode.LanguageModelTextPart) total += part.value.length;
		}
		return Math.max(1, Math.ceil(total / this.charsPerToken));
	}
}

// ---- Helpers ----

function toChatInfo(m: ModelDefinition, hasApiKey: boolean): ModelPickerChatInformation {
	return {
		id: m.id,
		name: m.name,
		family: m.family,
		version: m.version,
		detail: hasApiKey ? m.detail : API_KEY_REQUIRED_DETAIL,
		tooltip: hasApiKey ? undefined : API_KEY_REQUIRED_DETAIL,
		statusIcon: hasApiKey ? undefined : new vscode.ThemeIcon('warning'),
		maxInputTokens: m.maxInputTokens,
		maxOutputTokens: m.maxOutputTokens,
		isUserSelectable: true,
		capabilities: {
			toolCalling: m.capabilities.toolCalling,
			imageInput: m.capabilities.imageInput,
		},
		...(m.capabilities.thinking
			? { configurationSchema: THINKING_EFFORT_CONFIGURATION_SCHEMA }
			: {}),
	};
}

function getConfiguredThinkingEffort(options: ModelConfigurationOptions): ThinkingEffort {
	const configuredEffort =
		options.modelConfiguration?.reasoningEffort ?? options.configuration?.reasoningEffort;
	if (configuredEffort === 'none') return 'none';
	if (configuredEffort === 'high') return 'high';
	return configuredEffort === 'max' ? 'max' : 'high';
}
