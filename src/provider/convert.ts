import vscode from 'vscode';
import type {
    AnthropicContentBlock,
    AnthropicMessage,
    AnthropicTool,
    OpenAIMessage,
    OpenAITool,
    OpenAIToolCall,
} from '../types';
import type { ReasoningEntry } from './cache';

/**
 * Convert VS Code chat messages to OpenAI format (MiMo).
 * Injects cached reasoning_content for assistant messages that had tool calls
 * in prior turns.
 */
export function convertToOpenAIMessages(
	messages: readonly vscode.LanguageModelChatRequestMessage[],
	isThinkingModel: boolean,
	reasoningCache: Map<string, ReasoningEntry>,
): OpenAIMessage[] {
	const result: OpenAIMessage[] = [];

	for (const message of messages) {
		const role = mapRole(message.role);

		let content = '';
		const toolCalls: OpenAIToolCall[] = [];
		const toolResults: Array<{ callId: string; content: string }> = [];

		for (const part of message.content) {
			if (part instanceof vscode.LanguageModelTextPart) {
				content += part.value;
			} else if (part instanceof vscode.LanguageModelToolCallPart) {
				toolCalls.push({
					id: part.callId,
					type: 'function',
					function: {
						name: part.name,
						arguments: JSON.stringify(part.input),
					},
				});
			} else if (part instanceof vscode.LanguageModelToolResultPart) {
				let toolContent = '';
				for (const item of part.content) {
					if (item instanceof vscode.LanguageModelTextPart) {
						toolContent += item.value;
					}
				}
				toolResults.push({
					callId: part.callId,
					content: toolContent || JSON.stringify(part.content),
				});
			}
		}

		if (role === 'assistant') {
			let reasoningContent: string | undefined;
			if (isThinkingModel && toolCalls.length > 0) {
				for (const tc of toolCalls) {
					const cached = reasoningCache.get(tc.id);
					if (cached) {
						reasoningContent = cached.text;
						break;
					}
				}
			}

			if (content || toolCalls.length > 0) {
				const msg: OpenAIMessage = {
					role: 'assistant' as const,
					content: content || '',
				};

				if (toolCalls.length > 0) {
					msg.tool_calls = toolCalls;
				}

				if (isThinkingModel) {
					msg.reasoning_content = reasoningContent || '';
				}

				result.push(msg);
			}
		} else if (content) {
			result.push({
				role: role as 'user' | 'assistant',
				content: content,
			});
		}

		for (const tr of toolResults) {
			result.push({
				role: 'tool',
				content: tr.content,
				tool_call_id: tr.callId,
			});
		}
	}

	return result;
}

/**
 * Convert VS Code chat messages to Anthropic format (NSCC).
 */
export function convertToAnthropicMessages(
	messages: readonly vscode.LanguageModelChatRequestMessage[],
): AnthropicMessage[] {
	const result: AnthropicMessage[] = [];

	for (const message of messages) {
		const role = mapToAnthropicRole(message.role);
		const contentBlocks: AnthropicContentBlock[] = [];
		const toolResults: Array<{ callId: string; content: string; isError: boolean }> = [];

		for (const part of message.content) {
			if (part instanceof vscode.LanguageModelTextPart) {
				contentBlocks.push({ type: 'text', text: part.value });
			} else if (part instanceof vscode.LanguageModelToolCallPart) {
				contentBlocks.push({
					type: 'tool_use',
					id: part.callId,
					name: part.name,
					input: part.input as Record<string, unknown>,
				});
			} else if (part instanceof vscode.LanguageModelToolResultPart) {
				let toolContent = '';
				for (const item of part.content) {
					if (item instanceof vscode.LanguageModelTextPart) {
						toolContent += item.value;
					}
				}
				toolResults.push({
					callId: part.callId,
					content: toolContent || JSON.stringify(part.content),
					isError: false,
				});
			}
		}

		if (role === 'assistant' && contentBlocks.length > 0) {
			result.push({ role: 'assistant', content: contentBlocks });
		} else if (role === 'user') {
			// If there are content blocks (text/images), use them; otherwise empty
			if (contentBlocks.length > 0) {
				result.push({ role: 'user', content: contentBlocks });
			}
		}

		// Anthropic tool results go as user messages with tool_result blocks
		for (const tr of toolResults) {
			result.push({
				role: 'user',
				content: [
					{
						type: 'tool_result',
						tool_use_id: tr.callId,
						content: tr.content,
					},
				],
			});
		}
	}

	// Anthropic requires alternation: merge consecutive same-role messages
	return mergeConsecutiveSameRole(result);
}

function mergeConsecutiveSameRole(messages: AnthropicMessage[]): AnthropicMessage[] {
	const merged: AnthropicMessage[] = [];
	for (const msg of messages) {
		const last = merged[merged.length - 1];
		if (last && last.role === msg.role) {
			const lastContent = Array.isArray(last.content) ? last.content : [{ type: 'text' as const, text: String(last.content) }];
			const msgContent = Array.isArray(msg.content) ? msg.content : [{ type: 'text' as const, text: String(msg.content) }];
			last.content = [...lastContent, ...msgContent];
		} else {
			merged.push(msg);
		}
	}
	return merged;
}

function mapRole(role: vscode.LanguageModelChatMessageRole): 'user' | 'assistant' {
	switch (role) {
		case vscode.LanguageModelChatMessageRole.User:
			return 'user';
		case vscode.LanguageModelChatMessageRole.Assistant:
			return 'assistant';
		default:
			return 'user';
	}
}

function mapToAnthropicRole(role: vscode.LanguageModelChatMessageRole): 'user' | 'assistant' {
	switch (role) {
		case vscode.LanguageModelChatMessageRole.User:
			return 'user';
		case vscode.LanguageModelChatMessageRole.Assistant:
			return 'assistant';
		default:
			return 'user';
	}
}

/**
 * Convert VS Code tool definitions to OpenAI format.
 */
export function convertToOpenAITools(
	tools: readonly vscode.LanguageModelChatTool[] | undefined,
): OpenAITool[] | undefined {
	if (!tools || tools.length === 0) {
		return undefined;
	}

	return tools.map((tool) => ({
		type: 'function' as const,
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.inputSchema as Record<string, unknown> | undefined,
		},
	}));
}

/**
 * Convert VS Code tool definitions to Anthropic format.
 */
export function convertToAnthropicTools(
	tools: readonly vscode.LanguageModelChatTool[] | undefined,
): AnthropicTool[] | undefined {
	if (!tools || tools.length === 0) {
		return undefined;
	}

	return tools.map((tool) => ({
		name: tool.name,
		description: tool.description,
		input_schema: (tool.inputSchema as Record<string, unknown>) || { type: 'object', properties: {} },
	}));
}

/**
 * Count total characters across OpenAI messages (for chars-per-token calibration).
 */
export function countOpenAIMessageChars(messages: OpenAIMessage[]): number {
	let total = 0;
	for (const msg of messages) {
		total += msg.content?.length ?? 0;
		if (msg.tool_calls) {
			for (const tc of msg.tool_calls) {
				total += tc.function?.name?.length ?? 0;
				total += tc.function?.arguments?.length ?? 0;
			}
		}
	}
	return total;
}

