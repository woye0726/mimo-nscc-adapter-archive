import type { CancellationToken } from 'vscode';
import vscode from 'vscode';
import type { ModelFamily } from './config';
import type { ApiFormat } from './consts';
import { logger } from './logger';
import type {
    AnthropicRequest,
    AnthropicSSEEvent,
    OpenAIRequest,
    OpenAIStreamChunk,
    OpenAIToolCall,
    StreamCallbacks,
} from './types';

/**
 * Unified SSE-streaming API client supporting both:
 *  - MiMo (OpenAI format)
 *  - NSCC (Anthropic format)
 *
 * No external dependencies — uses Node's built-in fetch.
 */
export class MiMoNSCCClient {
	constructor(
		private readonly baseUrl: string,
		private readonly apiKey: string,
		private readonly format: ApiFormat,
		private readonly family: ModelFamily,
	) {}

	/**
	 * Stream a chat completion. Dispatches to the correct format handler.
	 */
	async streamChatCompletion(
		request: OpenAIRequest | AnthropicRequest,
		callbacks: StreamCallbacks,
		cancellationToken?: CancellationToken,
	): Promise<void> {
		if (this.format === 'anthropic') {
			return this._streamAnthropic(request as AnthropicRequest, callbacks, cancellationToken);
		}
		return this._streamOpenAI(request as OpenAIRequest, callbacks, cancellationToken);
	}

	// ---- OpenAI format (MiMo) ----

	private async _streamOpenAI(
		request: OpenAIRequest,
		callbacks: StreamCallbacks,
		cancellationToken?: CancellationToken,
	): Promise<void> {
		const controller = new AbortController();
		const cancelListener = cancellationToken?.onCancellationRequested(() => controller.abort());

		try {
			const requestBody = {
				...request,
				stream_options: { include_usage: true },
			};

			const response = await fetch(`${this.baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'api-key': this.apiKey,
				},
				body: JSON.stringify(requestBody),
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorText = await response.text();
				let errorMessage: string;
				try {
					const errorJson = JSON.parse(errorText);
					errorMessage = errorJson.error?.message || errorJson.message || errorText;
				} catch {
					errorMessage = errorText;
				}

				// Intercept auth / rate-limit errors with user-facing guidance
				_showErrorGuidance(response.status, errorMessage, this.family);

				throw new Error(`MiMo API error (${response.status}): ${errorMessage}`);
			}

			if (!response.body) {
				throw new Error('No response body received');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			const pendingToolCalls = new Map<number, OpenAIToolCall>();

			while (true) {
				if (cancellationToken?.isCancellationRequested) {
					controller.abort();
					break;
				}

				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed || trimmed.startsWith(':')) continue;

					if (trimmed === 'data: [DONE]') {
						for (const tc of pendingToolCalls.values()) callbacks.onToolCall(tc);
						pendingToolCalls.clear();
						callbacks.onDone();
						return;
					}

					if (!trimmed.startsWith('data: ')) continue;

					const jsonStr = trimmed.slice(6);
					try {
						const chunk: OpenAIStreamChunk = JSON.parse(jsonStr);
						const choice = chunk.choices?.[0];

						if (chunk.usage && callbacks.onUsage) {
							callbacks.onUsage(chunk.usage);
						}

						if (!choice) continue;

						const reasoning = choice.delta.reasoning_content;
						if (reasoning) callbacks.onThinking(reasoning);

						if (choice.delta.content) {
							callbacks.onContent(choice.delta.content);
						}

						if (choice.delta.tool_calls) {
							for (const tc of choice.delta.tool_calls) {
								let pending = pendingToolCalls.get(tc.index);
								if (!pending && tc.id) {
									pending = {
										id: tc.id,
										type: 'function',
										function: { name: '', arguments: '' },
									};
									pendingToolCalls.set(tc.index, pending);
								}
								if (pending) {
									if (tc.function?.name) pending.function.name += tc.function.name;
									if (tc.function?.arguments) pending.function.arguments += tc.function.arguments;
								}
							}
						}

						if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
							for (const tc of pendingToolCalls.values()) callbacks.onToolCall(tc);
							pendingToolCalls.clear();
						}
					} catch (e) {
						logger.error('Failed to parse OpenAI SSE chunk:', jsonStr.slice(0, 200), e);
					}
				}
			}

			callbacks.onDone();
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				callbacks.onDone();
				return;
			}
			callbacks.onError(error instanceof Error ? error : new Error(String(error)));
		} finally {
			cancelListener?.dispose();
		}
	}

	// ---- Anthropic format (MiMo /anthropic & NSCC) ----

	private async _streamAnthropic(
		request: AnthropicRequest,
		callbacks: StreamCallbacks,
		cancellationToken?: CancellationToken,
	): Promise<void> {
		const controller = new AbortController();
		const cancelListener = cancellationToken?.onCancellationRequested(() => controller.abort());

		// Auth header per family: MiMo uses api-key, NSCC uses x-api-key
		const authHeader = this.family === 'nscc' ? 'x-api-key' : 'api-key';

		try {
			const response = await fetch(`${this.baseUrl}/v1/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					[authHeader]: this.apiKey,
					'anthropic-version': '2023-06-01',
				},
				body: JSON.stringify(request),
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorText = await response.text();
				let errorMessage: string;
				try {
					const errorJson = JSON.parse(errorText);
					errorMessage = errorJson.error?.message || errorJson.message || errorText;
				} catch {
					errorMessage = errorText;
				}

				// Intercept auth / rate-limit errors with user-facing guidance
				_showErrorGuidance(response.status, errorMessage, this.family);

				const providerLabel = this.family === 'nscc' ? 'NSCC' : 'MiMo';
				throw new Error(`${providerLabel} API error (${response.status}): ${errorMessage}`);
			}

			if (!response.body) {
				throw new Error('No response body received');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			// Track content block state for Anthropic streaming
			const blockStates = new Map<number, { type: string; id: string; name: string; jsonAccum: string }>();
			let messageId = '';

			while (true) {
				if (cancellationToken?.isCancellationRequested) {
					controller.abort();
					break;
				}

				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed) continue;

					// Anthropic SSE: "event: <type>" followed by "data: <json>"
					let eventType = '';
					let eventData = '';

					if (trimmed.startsWith('event: ')) {
						eventType = trimmed.slice(7);
						continue;
					}

					if (trimmed.startsWith('data: ')) {
						eventData = trimmed.slice(6);
					} else {
						continue;
					}

					try {
						const event: AnthropicSSEEvent = JSON.parse(eventData);

						switch (event.type) {
							case 'message_start':
								messageId = event.message?.id || '';
								if (event.message?.usage && callbacks.onUsage) {
									callbacks.onUsage({
										prompt_tokens: event.message.usage.input_tokens,
										completion_tokens: event.message.usage.output_tokens,
										total_tokens:
											event.message.usage.input_tokens + event.message.usage.output_tokens,
										prompt_cache_hit_tokens: event.message.usage.cache_read_input_tokens,
										prompt_cache_miss_tokens: event.message.usage.cache_creation_input_tokens,
									});
								}
								break;

							case 'content_block_start': {
								const block = event.content_block;
								if (!block || event.index === undefined) break;
								if (block.type === 'thinking') {
									blockStates.set(event.index, {
										type: 'thinking',
										id: '',
										name: '',
										jsonAccum: '',
									});
									if (block.thinking) callbacks.onThinking(block.thinking);
								} else if (block.type === 'tool_use') {
									blockStates.set(event.index, {
										type: 'tool_use',
										id: block.id || '',
										name: block.name || '',
										jsonAccum: '',
									});
								} else {
									blockStates.set(event.index, {
										type: 'text',
										id: '',
										name: '',
										jsonAccum: '',
									});
								}
								break;
							}

							case 'content_block_delta': {
								const delta = event.delta;
								const idx = event.index ?? 0;
								const state = blockStates.get(idx);
								if (!delta) break;

								if (delta.type === 'thinking_delta' && delta.thinking) {
									callbacks.onThinking(delta.thinking);
								} else if (delta.type === 'text_delta' && delta.text) {
									callbacks.onContent(delta.text);
								} else if (delta.type === 'input_json_delta' && delta.partial_json) {
									if (state) {
										state.jsonAccum += delta.partial_json;
									}
								}
								break;
							}

							case 'content_block_stop': {
								const idx = event.index ?? 0;
								const state = blockStates.get(idx);
								if (state?.type === 'tool_use') {
									try {
										const args = JSON.parse(state.jsonAccum);
										callbacks.onToolCall({
											id: state.id,
											type: 'function',
											function: {
												name: state.name,
												arguments: JSON.stringify(args),
											},
										});
									} catch {
										callbacks.onToolCall({
											id: state.id,
											type: 'function',
											function: {
												name: state.name,
												arguments: state.jsonAccum,
											},
										});
									}
								}
								blockStates.delete(idx);
								break;
							}

							case 'message_delta':
								if (event.usage && callbacks.onUsage) {
									callbacks.onUsage({
										prompt_tokens: 0,
										completion_tokens: event.usage.output_tokens,
										total_tokens: event.usage.output_tokens,
									});
								}
								break;

							case 'message_stop':
								callbacks.onDone();
								return;
						}
					} catch (e) {
						logger.error('Failed to parse Anthropic SSE event:', eventData.slice(0, 200), e);
					}
				}
			}

			callbacks.onDone();
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				callbacks.onDone();
				return;
			}
			callbacks.onError(error instanceof Error ? error : new Error(String(error)));
		} finally {
			cancelListener?.dispose();
		}
	}
}

// ---- Error interception ----

/** Show VS Code notifications for 401 / 429 / 403 errors with provider‑specific guidance. */
function _showErrorGuidance(status: number, message: string, family: ModelFamily): void {
	if (family === 'nscc') {
		if (status === 401) {
			void vscode.window
				.showErrorMessage(
					'NSCC 鉴权失败 (401)。请检查 API Key 是否正确配置。运行 "MiMo-NSCC: Set NSCC API Key" 重新设置。',
					'Open Settings',
				)
				.then((action: string | undefined) => {
					if (action === 'Open Settings') {
						void vscode.commands.executeCommand('workbench.action.openSettings', 'mimo-nscc.nsccApiKey');
					}
				});
			return;
		}
		if (status === 429) {
			void vscode.window.showWarningMessage(
				'NSCC 速率限制 (429)。请检查账户额度或稍后重试。如在校内网络环境下，请确认校园网连接正常。',
			);
			return;
		}
		if (status === 403) {
			void vscode.window.showWarningMessage(
				'NSCC 访问被拒 (403)。请确认您的账户已获得超算长沙中心授权，或检查 API Key 是否有效。',
			);
			return;
		}
	} else {
		// MiMo family (OpenAI format)
		if (status === 401) {
			void vscode.window
				.showErrorMessage(
					'MiMo 鉴权失败 (401)。请检查 API Key 是否正确。运行 "MiMo-NSCC: Set MiMo API Key" 重新设置。',
					'Open Settings',
				)
				.then((action: string | undefined) => {
					if (action === 'Open Settings') {
						void vscode.commands.executeCommand('workbench.action.openSettings', 'mimo-nscc.mimoApiKey');
					}
				});
			return;
		}
		if (status === 429) {
			void vscode.window.showWarningMessage(
				'MiMo 速率限制 (429)。请检查 Token Plan 额度或稍后重试。北京时间 00:00–08:00 享 8 折夜间优惠。',
			);
			return;
		}
	}
	// Fallback: log unknown errors
	logger.error(`API error ${status}: ${message}`);
}
