# Fix Writing

Local Raycast extension that fixes spelling and grammar of the selected text with any OpenAI-compatible provider and pastes the result back in place.

## Commands

- **Fix Writing**: shows the fixed text next to the original. Press `Enter` to paste it over your selection, `Cmd+R` to retry, `Cmd+M` to switch model.
- **Fix Writing Instantly**: no preview, replaces the selection right away with the first model. Good for a hotkey.

## Setup

Needs Node 22+, pnpm and Raycast.

```sh
git clone https://github.com/unveroleone/raycast-fix-writing.git
cd raycast-fix-writing
pnpm install
pnpm build
```

`pnpm build` installs the extension into Raycast (`~/.config/raycast/extensions/fix-writing`). Run it again after changes. Use `pnpm dev` only if you want hot reload while editing.

Then set the preferences (Raycast Settings > Extensions > Fix Writing):

| Preference | Example |
| --- | --- |
| Provider Base URL | `https://api.openai.com/v1`, `https://api.deepseek.com/v1`, `https://openrouter.ai/api/v1`, `http://localhost:11434/v1` |
| API Key | your key, empty for Ollama or LM Studio |
| Models | `gpt-4o-mini, deepseek-chat` (first one is the default) |
| Writing Style | on by default: removes em dashes, AI-sounding words and filler |
| Extra Instructions | `Use Swiss spelling (ss instead of ß).` |
| Instructions File | a `.md` style guide for longer rules |

Assign hotkeys to the commands in Raycast Settings to use them from any app.
