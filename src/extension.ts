import vscode from 'vscode';
import { CONFIG_SECTION, WALKTHROUGH_ID, WELCOME_SHOWN_KEY } from './consts';
import { logger } from './logger';
import { MiMoNSCCChatProvider } from './provider';

let activeProvider: MiMoNSCCChatProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
	logger.info('Activating MiMo-NSCC extension');

	context.subscriptions.push(
		vscode.commands.registerCommand('mimo-nscc.showLogs', () => logger.show()),
		vscode.commands.registerCommand('mimo-nscc.getMimoApiKey', () =>
			vscode.env.openExternal(vscode.Uri.parse('https://api.xiaomimimo.com')),
		),
		vscode.commands.registerCommand('mimo-nscc.getNsccApiKey', () =>
			vscode.env.openExternal(vscode.Uri.parse('https://maas.nscc-cs.cn')),
		),
		vscode.commands.registerCommand('mimo-nscc.openSettings', () =>
			vscode.commands.executeCommand('workbench.action.openSettings', CONFIG_SECTION),
		),
	);

	try {
		const provider = new MiMoNSCCChatProvider(context);
		activeProvider = provider;

		context.subscriptions.push(
			vscode.commands.registerCommand('mimo-nscc.setMimoApiKey', () =>
				provider.configureMimoApiKey(),
			),
			vscode.commands.registerCommand('mimo-nscc.setNsccApiKey', () =>
				provider.configureNsccApiKey(),
			),
			vscode.commands.registerCommand('mimo-nscc.clearMimoApiKey', () =>
				provider.clearMimoApiKey(),
			),
			vscode.commands.registerCommand('mimo-nscc.clearNsccApiKey', () =>
				provider.clearNsccApiKey(),
			),
			vscode.commands.registerCommand('mimo-nscc.setVisionModel', () =>
				provider.setVisionProxyModel(),
			),
			vscode.lm.registerLanguageModelChatProvider('mimo-nscc', provider),
		);

		void showWelcomeIfNeeded(context, provider).catch((error) => {
			logger.warn('Failed to show MiMo-NSCC welcome prompt', error);
		});

		logger.info('MiMo-NSCC extension activated');
	} catch (error) {
		activeProvider = undefined;
		logger.error('Failed to activate MiMo-NSCC extension', error);
		void vscode.window.showErrorMessage(
			'MiMo-NSCC failed to activate. Run "MiMo-NSCC: Show Logs" for details.',
		);
		throw error;
	}
}

async function showWelcomeIfNeeded(
	context: vscode.ExtensionContext,
	provider: MiMoNSCCChatProvider,
): Promise<void> {
	if (context.globalState.get<boolean>(WELCOME_SHOWN_KEY)) {
		return;
	}
	if (await provider.hasAnyApiKey()) {
		await context.globalState.update(WELCOME_SHOWN_KEY, true);
		return;
	}

	await vscode.commands.executeCommand('workbench.action.openWalkthrough', WALKTHROUGH_ID, false);
	await context.globalState.update(WELCOME_SHOWN_KEY, true);
}

export async function deactivate() {
	try {
		await activeProvider?.prepareForDeactivate();
	} catch (error) {
		logger.warn('Failed to prepare MiMo-NSCC provider for deactivate', error);
	} finally {
		activeProvider = undefined;
		logger.info('MiMo-NSCC extension deactivated');
		logger.dispose();
	}
}
