<h1 align="center">MiMo & NSCC Copilot Bridge</h1>

> **Based on** [Vizards/deepseek-v4-for-copilot](https://github.com/Vizards/deepseek-v4-for-copilot) — forked and re‑architected as a dual‑protocol, multi‑model bridge for MiMo (Xiaomi) and NSCC.

**Pick MiMo & NSCC from the Copilot Chat model picker — and keep everything else Copilot already gives you.**



Want MiMo V2.5 Pro's agent performance inside Copilot Chat? Or need NSCC's Qwen3.5 via Anthropic protocol? This extension drops **5 MiMo models + NSCC Qwen3.5** straight into the Copilot Chat model selector — with **native MiMo vision**, **thinking mode**, **dual‑protocol routing**, and your own API keys.

## Why this extension?

- **Don't replace Copilot — power it up.** No new sidebar, no new chat UI to learn. Two new model families in the picker you already use.
- **Two protocols, zero switching.** MiMo speaks OpenAI (`api-key` header). NSCC speaks Anthropic (`x-api-key` header, content‑block SSE events). Both families coexist in the picker — no mode toggle, no reload.
- **Agent mode, tool calling, instructions, MCP, skills — all of it still works.** Copilot's entire stack, now running on MiMo V2.5 Pro or NSCC Qwen3.5.
- **Native MiMo Vision.** MiMo V2.5 and V2 Omni natively understand images — drop a screenshot and they read it directly. NSCC Qwen3.5 uses a transparent proxy (hands the image to another Copilot model for description). Auto‑routed per model, zero config.
- **BYOK, pay providers directly.** Your API keys, your bill, your rate limits. MiMo and NSCC each get their own key, stored in the OS keychain, never on disk.

## Features

### 5 MiMo Models + NSCC Qwen3.5 in the picker
Five MiMo models — V2.5 Pro, V2.5, V2 Pro, V2 Omni, V2 Flash — plus NSCC Qwen3.5, all side‑by‑side in Copilot Chat's model selector. Switch freely between them mid‑chat without losing history. Pick V2.5 Pro for hard agent workloads, V2 Flash for quick edits, V2 Omni for native vision, or Qwen3.5 for Anthropic‑native workflows.

### Native Vision & Proxy Support
MiMo V2.5 and V2 Omni process images natively — drop a screenshot and they read it directly, no proxy needed. NSCC Qwen3.5 is text‑only; the extension automatically hands images to another installed Copilot model (Claude, GPT‑4o, etc.), gets a text description, and feeds it back — transparently, per model. **Zero config** — just pick your preferred vision proxy model once.

### Thinking Mode with Reasoning Effort Control
Full support for MiMo's `reasoning_content` and NSCC's thinking deltas. Reasoning renders as collapsible blocks in the chat. Use Copilot Chat's native model picker menu to choose `none` (off), `high` (balanced, default), or `max` (deep reasoning for complex agent tasks).

### Dual‑Protocol, Single Provider
Each model carries its own format at the data level — `apiFormat: 'openai'` for MiMo, `apiFormat: 'anthropic'` for NSCC. The provider resolves the correct API key, base URL, SSE parser, and auth header transparently at request time. No `providerMode` setting, no switching — just pick a model and go.

### Inherits Every Copilot Capability
Because this plugs into Copilot's native provider API, you get the full stack for free:
- **Agent mode** — autonomous, multi‑step tasks with hundreds of tool calls
- **Tool calling** — file edits, terminal, workspace search, Git, tests
- **Instructions & skills** — all your `.instructions.md`, `AGENTS.md`, and skills just work
- **Multi‑turn reasoning cache** — preserves `reasoning_content` across tool‑call rounds (per MiMo API docs)

### Secure by Default
Both API keys live in VS Code's `SecretStorage` (OS keychain on macOS / Windows / Linux). Never in `settings.json`, never in your Git history. Each provider gets its own isolated key slot.

### Zero Runtime Dependencies
Pure VS Code API + Node.js built‑ins. No Python, no Docker, no local proxy server to babysit.

## Getting Started

### Prerequisites

- VS Code 1.116 or later. This extension relies on non‑public Copilot Chat APIs that may break on newer VS Code versions — [report an issue](https://github.com/mimo-user/mimo-nscc-adapter/issues) if you hit one.
- GitHub Copilot subscription (Free / Pro / Enterprise — the free tier works)
- At least one API key:
  - **MiMo** — from [platform.xiaomimimo.com](https://platform.xiaomimimo.com). MiMo V2.5 series is now in public beta, with MiMo V2.5 Pro delivering Claude Opus 4.6 / GPT‑5.4 class agent performance.
  - **NSCC** — from [maas.nscc-cs.cn](https://maas.nscc-cs.cn). Provides Qwen3.5 access via Anthropic‑compatible API.

### Usage

1. Install from the VS Code Marketplace
2. Run **MiMo-NSCC: Set MiMo API Key** from the Command Palette (`Cmd+Shift+P`) and paste your MiMo key
3. Run **MiMo-NSCC: Set NSCC API Key** and paste your NSCC key (optional — only if you plan to use NSCC models)
4. Open Copilot Chat, click the model picker, and choose from **5 MiMo models** (V2.5 Pro, V2.5, V2 Pro, V2 Omni, V2 Flash) or **Qwen3.5 (NSCC)**. Switch freely mid‑chat — pick V2 Flash for quick edits, V2.5 Pro for deep reasoning, V2 Omni for image tasks.
5. That's it — chat away

## Models

| Model | Family | Protocol | Best For |
|---|---|---|---|
| **MiMo V2.5 Pro** | `mimo` | OpenAI | Hard agent tasks, deep reasoning, multi‑hundred tool‑call sessions. 1T/42B, 1M ctx. |
| **MiMo V2.5** | `mimo` | OpenAI | Everyday agent tasks, native multimodal (image/video/audio). 1M ctx, 50% cheaper. |
| **MiMo V2 Pro** | `mimo` | OpenAI | Previous flagship. GPT‑4.5 class agent baseline. 1T/42B, 1M ctx. |
| **MiMo V2 Omni** | `mimo` | OpenAI | Vision‑native model — image understanding without proxy. 256K ctx. |
| **MiMo V2 Flash** | `mimo` | OpenAI | Fast & cheap iteration. 97% tool‑call success. SWA acceleration. |
| **Qwen3.5 (NSCC)** | `nscc` | Anthropic | NSCC Qwen3.5 via Anthropic‑native API. 国家超算长沙中心. |

MiMo V2.5 Pro is Xiaomi's flagship agent model — benchmarked completing a full SysY compiler in Rust (672 tool calls, 4.3‑hour marathon, 233/233 score) and a video editor web app (8,192 lines, 1,868 tool calls, 11.5 hours). It competes head‑to‑head with Claude Opus 4.6 and GPT‑5.4 on SWE‑bench.

All MiMo models support thinking mode and tool calling. All 6 models are always visible in the picker — each independently gated by whether its API key is configured.

## Commands

| Command | Action |
|---|---|
| `MiMo-NSCC: Set MiMo API Key` | Store MiMo API key in OS keychain |
| `MiMo-NSCC: Set NSCC API Key` | Store NSCC API key in OS keychain |
| `MiMo-NSCC: Clear MiMo API Key` | Remove MiMo API key |
| `MiMo-NSCC: Clear NSCC API Key` | Remove NSCC API key |
| `MiMo-NSCC: Get MiMo API Key` | Open MiMo API platform |
| `MiMo-NSCC: Get NSCC API Key` | Open NSCC API platform |
| `MiMo-NSCC: Set Vision Proxy Model` | Pick a model to describe image attachments |
| `MiMo-NSCC: Open Settings` | Open extension settings |
| `MiMo-NSCC: Show Logs` | Open the MiMo‑NSCC‑Copilot output channel |

## Settings

All settings live under the `mimo-nscc` namespace.

| Setting | Default | Description |
|---|---|---|
| `mimo-nscc.mimoBaseUrl` | `https://api.xiaomimimo.com/v1` | MiMo API endpoint (OpenAI‑compatible). |
| `mimo-nscc.nsccBaseUrl` | `https://maas.nscc-cs.cn/external/api` | NSCC API endpoint (Anthropic‑compatible). |
| `mimo-nscc.mimoModelId` | *(empty)* | API model ID for MiMo requests. Leave empty to use the model you picked. |
| `mimo-nscc.nsccModelId` | `Qwen3.5` | API model ID for NSCC requests. |
| `mimo-nscc.maxTokens` | `0` | Max output tokens per request (`0` = no limit). |
| `mimo-nscc.visionModel` | *(auto)* | Which Copilot model to proxy images through. |
| `mimo-nscc.visionPrompt` | *(built‑in)* | Prompt used to describe image attachments. |
| `mimo-nscc.mimoApiKey` | *(empty)* | MiMo API key fallback for CI/automation. Prefer the command. |
| `mimo-nscc.nsccApiKey` | *(empty)* | NSCC API key fallback for CI/automation. Prefer the command. |

Thinking Effort is configured per‑model from Copilot Chat's model picker dropdown (None / High / Max).

## Troubleshooting

### `TypeError: fetch failed`

- **API key mismatch.** MiMo uses `api-key` header; NSCC uses `x-api-key`. A MiMo key won't authenticate against NSCC and vice versa. Run the corresponding `Set API Key` command for the model you're calling.
- **Network / proxy.** If you're behind a corporate proxy, VS Code respects `http.proxy` settings. Verify reachability:
  ```bash
  curl -I https://api.xiaomimimo.com/v1/models
  curl -I https://maas.nscc-cs.cn/external/api/v1/models
  ```
- **Check the output channel.** Run `MiMo-NSCC: Show Logs` to inspect the full request URL, response status, and error body. The channel is named **MiMo-NSCC-Copilot** in the Output panel.

### Model shows a warning icon

Each model family gates independently on its API key. Run the matching command — `Set MiMo API Key` for MiMo models, `Set NSCC API Key` for NSCC models.

### Models don't appear in the picker

Run `MiMo-NSCC: Show Logs` and look for the `MiMo-NSCC extension activated` message. If absent, the extension failed to load. Verify VS Code ≥ 1.116.0.

## How It Works

```
Model picker
    ├─ MiMo models (×5) → family=mimo  → apiFormat=openai
    │   ├─ Auth:    "api-key: <MiMo key>"
    │   ├─ POST     https://api.xiaomimimo.com/v1/chat/completions
    │   ├─ Vision:  Native (V2.5 / V2 Omni) or proxy fallback
    │   └─ SSE:     OpenAI chunks + reasoning_content injection
    │
    └─ Qwen3.5 (NSCC)    → family=nscc  → apiFormat=anthropic
        ├─ Auth:    "x-api-key: <NSCC key>" + "anthropic-version: 2023-06-01"
        ├─ POST     https://maas.nscc-cs.cn/external/api/v1/messages
        ├─ Vision:  Proxy via another Copilot model
        └─ SSE:     content_block_start / delta / stop + message_delta events
```

Each model's family determines its API key, base URL, SSE parser, and vision strategy — all resolved at request time.

## Compared to alternatives

| | This extension | Claude Code (NSCC) | MiMo Web Chat |
|---|---|---|---|
| Works inside Copilot Chat | ✅ | ❌ separate CLI | ❌ browser UI |
| Agent mode, tools, skills | ✅ | ⚠️ reimplemented | ❌ |
| Both providers, one install | ✅ MiMo + NSCC | ❌ NSCC only | ❌ MiMo only |
| Vision support | ✅ Native (MiMo) / Proxied (NSCC) | ⚠️ limited | ✅ native |
| Extra process to run | ❌ | ✅ Node.js daemon | ❌ |
| API key in OS keychain | ✅ | ⚠️ env vars / config file | ❌ browser |
| One‑click install | ✅ | ❌ | ❌ |

## License

[MIT](LICENSE)


