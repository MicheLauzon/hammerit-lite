# Trinity's prototypes, 25 Nov 2026

Two prototypes built on Miche's 0.15 files. UI and page-reading only; the engine (0.15.1) is unchanged.
The full write-up of the issues behind them is in the "HammerIT setup: issues and fixes (25 Nov)" doc Trinity shares.

## claude-code-prototype/ — smaller terminal pane

Based on HammerIT for Claude Code 0.15.0 (`~/.hammerit/claude_code`). Changes, all in `hooks/register.tsx`:

- The pane asks for 34 columns docked / 14 rows inline (`$.ui.open` `columns`, `rows`).
- It no longer opens at session start; it opens from the bar above the prompt (Open, key 1).
- When the engine is off, the bar shows one line instead of an empty pane.
- Shorter pane: colour key on two lines; the keys hint and the requests/actions/refused line removed.
- `call()` retries once after 1.5 s when the engine answers with an error, so an engine error is no longer shown as "not running".

Try it in one terminal without the installed add-on:

    CLAUDE_CODE_PLUGIN_DIRS= claude --plugin-dir "<this repo>/claude-code-prototype"

## chatgpt-extension-trial/ — HammerIT lite panel on chatgpt.com

Based on the 0.15.0 Chrome extension (`~/.hammerit/extension_lite`). Load unpacked beside the claude.ai one; it shows as "HammerIT lite (ChatGPT trial)".

- Runs on `https://chatgpt.com/*` only; no `sync.js` (it calls claude.ai's API).
- Chat id from `/c/<id>`, saved as `gpt-<id>`; captures send `tool: 'ChatGPT'`.
- Reading (chatgpt.com, Nov 2026): each exchange is `[data-turn-key]`; your text is `[data-user-message-bubble]`; the reply is `[data-markdown-text-style="assistant-message"]` (fallback `[data-response-body]`).
- ChatGPT keeps about three exchanges on the page; the trial remembers exchanges seen while the chat is open. Long chats are only covered as far as you scroll.
- A "Trial check: 0 messages found" line appears only if ChatGPT changes its labels.
