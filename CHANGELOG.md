# Changelog

## [0.4.0](https://github.com/woye0726/mimo-nscc-adapter-archive/compare/v0.3.0...v0.4.0) (2026-05-01)


### Features

* complete mimo routing fix and branding assets (v0.4.0) ([c530a40](https://github.com/woye0726/mimo-nscc-adapter-archive/commit/c530a40ebcf66aedff603d833d2ad4ce4348c968))

## [0.4.0](https://github.com/mimo-user/mimo-nscc-adapter/compare/v0.3.0...v0.4.0) (2026-04-30)

### Breaking — Rebrand & Dual‑Protocol Architecture

This release **rebrands** the extension from `deepseek-v4-for-copilot` to `mimo-nscc-adapter` with a full dual‑protocol, dual‑provider architecture. The new extension ID (`mimo-user.mimo-nscc-adapter`) is isolated from the original and can be installed side‑by‑side.

* **Dual‑track model families.** MiMo V2.5 Pro (OpenAI format) and NSCC Qwen3.5 (Anthropic format) appear together in the Copilot Chat model picker — no `providerMode` toggle, no configuration reload.
* **Independent API keys.** `mimo-nscc.mimoApiKey` and `mimo-nscc.nsccApiKey` are separate credentials stored in isolated `SecretStorage` slots. Set one, set both — each model's availability gates on its own key.
* **Protocol‑native headers.** MiMo uses `api-key` (not `Bearer`). NSCC uses `x-api-key` + `anthropic-version: 2023-06-01`.
* **Anthropic SSE streaming.** Full content‑block streaming parser for NSCC — `content_block_start` / `content_block_delta` (text_delta, input_json_delta, thinking_delta) / `content_block_stop` / `message_delta` / `message_stop`.
* **Per‑family configuration.** Dedicated `mimoBaseUrl` / `nsccBaseUrl`, `mimoModelId` / `nsccModelId` settings. Defaults: MiMo → `https://api.xiaomimimo.com/v1` + `mimo-v2.5-pro`, NSCC → `https://maas.nscc-cs.cn/external/api` + `Qwen3.5`.
* **MiMo V2.5 Pro identity.** Automatic `MiMo` system prompt injection per Xiaomi API docs, `reasoning_content` multi‑turn caching.
* **All commands renamed.** Commands migrated from `deepseek-copilot.*` to `mimo-nscc.*` namespace with separate Set/Clear/Get commands for each provider.
* **Output channel.** Renamed from `DeepSeek` to `MiMo-NSCC-Copilot`.
* **Configuration namespace.** All settings migrated from `deepseek-copilot.*` to `mimo-nscc.*`.

### Previous releases

See [v0.3.0](https://github.com/Vizards/deepseek-v4-for-copilot/releases/tag/v0.3.0) and earlier in the original `Vizards/deepseek-v4-for-copilot` repository.
