import type { ApiFormat } from './consts';

/**
 * Shared types for the MiMo-NSCC Copilot extension.
 */

// ---- API request/response types (OpenAI format — MiMo) ----

export interface OpenAIMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	tool_call_id?: string;
	tool_calls?: OpenAIToolCall[];
	reasoning_content?: string;
}

export interface OpenAIToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string;
	};
}

export interface OpenAITool {
	type: 'function';
	function: {
		name: string;
		description?: string;
		parameters?: Record<string, unknown>;
	};
}

export interface OpenAIRequest {
	model: string;
	messages: OpenAIMessage[];
	stream: boolean;
	temperature?: number;
	top_p?: number;
	max_tokens?: number;
	tools?: OpenAITool[];
	tool_choice?: 'none' | 'auto' | 'required';
	thinking?: { type: 'enabled' | 'disabled' };
	reasoning_effort?: 'high' | 'max';
	stream_options?: {
		include_usage: boolean;
	};
}

export interface OpenAIStreamChunk {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		delta: {
			role?: string;
			content?: string;
			reasoning_content?: string;
			tool_calls?: Array<{
				index: number;
				id?: string;
				type?: string;
				function?: {
					name?: string;
					arguments?: string;
				};
			}>;
		};
		finish_reason: string | null;
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
		prompt_cache_hit_tokens?: number;
		prompt_cache_miss_tokens?: number;
	};
}

// ---- API request/response types (Anthropic format — NSCC) ----

export interface AnthropicContentBlock {
	type: 'text' | 'tool_use' | 'tool_result' | 'thinking';
	text?: string;
	id?: string;
	name?: string;
	input?: Record<string, unknown>;
	/** tool_result fields */
	tool_use_id?: string;
	content?: string | AnthropicContentBlock[];
	/** thinking fields */
	thinking?: string;
	signature?: string;
}

export interface AnthropicMessage {
	role: 'user' | 'assistant';
	content: AnthropicContentBlock[] | string;
}

export interface AnthropicTool {
	name: string;
	description?: string;
	input_schema: Record<string, unknown>;
}

export interface AnthropicRequest {
	model: string;
	messages: AnthropicMessage[];
	max_tokens: number;
	system?: string;
	stream: boolean;
	temperature?: number;
	top_p?: number;
	tools?: AnthropicTool[];
	tool_choice?: { type: 'auto' | 'any' | 'tool'; name?: string };
	thinking?: { type: 'enabled'; budget_tokens: number } | { type: 'disabled' };
}

export interface AnthropicSSEEvent {
	type:
		| 'message_start'
		| 'content_block_start'
		| 'content_block_delta'
		| 'content_block_stop'
		| 'message_delta'
		| 'message_stop'
		| 'ping';
	message?: {
		id: string;
		model: string;
		usage?: {
			input_tokens: number;
			output_tokens: number;
			cache_creation_input_tokens?: number;
			cache_read_input_tokens?: number;
		};
	};
	content_block?: {
		type: 'text' | 'tool_use' | 'thinking';
		text?: string;
		id?: string;
		name?: string;
		input?: Record<string, unknown>;
		thinking?: string;
		signature?: string;
	};
	delta?: {
		type: 'text_delta' | 'input_json_delta' | 'thinking_delta' | 'signature_delta';
		text?: string;
		partial_json?: string;
		thinking?: string;
		signature?: string;
	};
	index?: number;
	usage?: {
		input_tokens: number;
		output_tokens: number;
		cache_creation_input_tokens?: number;
		cache_read_input_tokens?: number;
	};
	delta_usage?: {
		output_tokens: number;
	};
}

// ---- Stream callbacks ----

export interface StreamCallbacks {
	onContent: (content: string) => void;
	onThinking: (text: string) => void;
	onToolCall: (toolCall: OpenAIToolCall) => void;
	onError: (error: Error) => void;
	onDone: () => void;
	onUsage?: (usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
		prompt_cache_hit_tokens?: number;
		prompt_cache_miss_tokens?: number;
	}) => void;
}

// ---- Model definitions ----

export interface ModelDefinition {
	id: string;
	name: string;
	family: string;
	version: string;
	detail: string;
	maxInputTokens: number;
	maxOutputTokens: number;
	capabilities: {
		toolCalling: boolean;
		imageInput: boolean;
		thinking: boolean;
	};
	requiresThinkingParam: boolean;
	/** Which API format this model family uses: 'openai' or 'anthropic'. */
	apiFormat: ApiFormat;
}
