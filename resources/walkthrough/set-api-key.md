MiMo & NSCC Copilot Bridge uses separate API keys for each provider — configure one or both, your call.

**Get your keys:**

- **MiMo (Xiaomi):** [platform.xiaomimimo.com](https://platform.xiaomimimo.com) — MiMo V2.5 series is now in public beta. Create an API Key under 控制台 → API Keys.
- **NSCC:** [maas.nscc-cs.cn](https://maas.nscc-cs.cn) — provides Qwen3.5 via Anthropic‑compatible API.

**MiMo V2.5 Pro tip:** Use the recommended system prompt for best results:

> You are MiMo, an AI assistant developed by Xiaomi.
> Today's date: {date} {week}. Your knowledge cutoff date is December 2024.

The extension injects this automatically when calling MiMo.

Paste each key once — they're stored in the OS keychain via VS Code `SecretStorage`, never on disk.

- `Cmd/Ctrl + Shift + P`: Open the Command Palette
- `MiMo-NSCC: Set MiMo API Key`: Set or update your MiMo key
- `MiMo-NSCC: Set NSCC API Key`: Set or update your NSCC key
- `MiMo-NSCC: Clear MiMo API Key` / `Clear NSCC API Key`: Remove keys
- `MiMo-NSCC: Get MiMo API Key` / `Get NSCC API Key`: Open the respective platform
