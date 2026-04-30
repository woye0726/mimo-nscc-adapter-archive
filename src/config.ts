import vscode from 'vscode';
import { CONFIG_SECTION } from './consts';
import { logger } from './logger';

/** Model family identifier. */
export type ModelFamily = 'mimo' | 'nscc';

/**
 * Get the API base URL for a given model family.
 */
export function getBaseUrl(family: ModelFamily): string {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	if (family === 'nscc') {
		return config.get<string>('nsccBaseUrl') || 'https://maas.nscc-cs.cn/external/api';
	}
	return config.get<string>('mimoBaseUrl') || 'https://api.xiaomimimo.com/v1';
}

/**
 * Resolve the API model ID for a given model family.
 */
export function getApiModelId(family: ModelFamily, fallbackId: string): string {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	if (family === 'nscc') {
		return config.get<string>('nsccModelId') || 'Qwen3.5';
	}
	return config.get<string>('mimoModelId') || fallbackId;
}

/**
 * Get the API key from settings fallback for a given model family.
 *
 * ⚠️ WARNING: This reads the API key from VS Code settings.json, which means
 * it could be synced or committed to Git if the user's settings are not
 * properly excluded. Prefer using SecretStorage (OS keychain) via the
 * "MiMo-NSCC: Set API Key" commands instead.
 */
export function getSettingsApiKey(family: ModelFamily): string | undefined {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	const key = family === 'nscc'
		? config.get<string>('nsccApiKey')
		: config.get<string>('mimoApiKey');
	const trimmed = key?.trim();
	if (trimmed) {
		const label = family === 'nscc' ? 'NSCC' : 'MiMo';
		logger.warn(
			`${label} API key read from settings.json fallback — ` +
			`prefer using the "MiMo-NSCC: Set ${label} API Key" command ` +
			`which stores the key securely in the OS keychain.`,
		);
	}
	return trimmed || undefined;
}

/**
 * Get the configured max output tokens limit.
 * Returns `undefined` when set to 0 (API default — no limit).
 */
export function getMaxTokens(): number | undefined {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	const value = config.get<number>('maxTokens', 0);
	return value > 0 ? value : undefined;
}
