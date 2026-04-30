import vscode from 'vscode';
import { type ModelFamily, getSettingsApiKey } from './config';
import { MIMO_API_KEY_SECRET, NSCC_API_KEY_SECRET } from './consts';

/**
 * Manages API keys for MiMo and NSCC via VS Code SecretStorage (secure)
 * with fallback to extension settings (less secure, for CI/automation).
 */
export class AuthManager {
	private readonly secretStorage: vscode.SecretStorage;

	constructor(context: vscode.ExtensionContext) {
		this.secretStorage = context.secrets;
	}

	// ---- Generic: get key for a family ----

	/**
	 * Get API key for a model family. SecretStorage first, then settings fallback.
	 */
	async getApiKey(family: ModelFamily): Promise<string | undefined> {
		const secretKey = family === 'nscc'
			? NSCC_API_KEY_SECRET
			: MIMO_API_KEY_SECRET;

		const stored = await this.secretStorage.get(secretKey);
		if (stored) {
			return stored;
		}

		return getSettingsApiKey(family);
	}

	/**
	 * Store API key for a model family in SecretStorage.
	 */
	async setApiKey(family: ModelFamily, apiKey: string): Promise<void> {
		const secretKey = family === 'nscc'
			? NSCC_API_KEY_SECRET
			: MIMO_API_KEY_SECRET;
		await this.secretStorage.store(secretKey, apiKey.trim());
	}

	/**
	 * Delete stored API key for a model family.
	 */
	async deleteApiKey(family: ModelFamily): Promise<void> {
		const secretKey = family === 'nscc'
			? NSCC_API_KEY_SECRET
			: MIMO_API_KEY_SECRET;
		await this.secretStorage.delete(secretKey);
	}

	/**
	 * Check if an API key is configured for a family.
	 */
	async hasApiKey(family: ModelFamily): Promise<boolean> {
		const key = await this.getApiKey(family);
		return key !== undefined && key.length > 0;
	}

	/**
	 * Check if ANY API key is configured (MiMo or NSCC).
	 */
	async hasAnyApiKey(): Promise<boolean> {
		return (await this.hasApiKey('mimo')) || (await this.hasApiKey('nscc'));
	}

	// ---- Interactive prompts ----

	/**
	 * Prompt user to enter MiMo API key.
	 */
	async promptForMimoApiKey(): Promise<boolean> {
		const apiKey = await vscode.window.showInputBox({
			prompt: 'Enter your MiMo (Xiaomi) API key',
			placeHolder: 'Enter MiMo API key...',
			password: true,
			ignoreFocusOut: true,
			validateInput: (value: string) => {
				if (!value?.trim()) return 'API key cannot be empty';
				return undefined;
			},
		});

		if (apiKey) {
			await this.setApiKey('mimo', apiKey);
			vscode.window.showInformationMessage('MiMo API key saved securely.');
			return true;
		}
		return false;
	}

	/**
	 * Prompt user to enter NSCC API key.
	 */
	async promptForNsccApiKey(): Promise<boolean> {
		const apiKey = await vscode.window.showInputBox({
			prompt: 'Enter your NSCC API key',
			placeHolder: 'Enter NSCC API key...',
			password: true,
			ignoreFocusOut: true,
			validateInput: (value: string) => {
				if (!value?.trim()) return 'API key cannot be empty';
				return undefined;
			},
		});

		if (apiKey) {
			await this.setApiKey('nscc', apiKey);
			vscode.window.showInformationMessage('NSCC API key saved securely.');
			return true;
		}
		return false;
	}
}
