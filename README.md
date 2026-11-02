# Fix Writing

Local Raycast extension that fixes spelling and grammar of the selected text with any OpenAI-compatible provider and pastes the result back in place.

## Why this one

Most AI writing extensions for Raycast show the result in a window and leave you to copy it, and they are tied to one provider with a fixed model list. This one is built for the opposite workflow:

- **It replaces your text in place.** Press `Enter` in the preview and the fixed text goes straight over your selection. With **Fix Writing Instantly** there is no window at all: select, hit the hotkey, done.
- **It works with any provider.** Anything that speaks the OpenAI API works, from OpenAI, DeepSeek and OpenRouter to Groq or a local Ollama model. You type in the model IDs you want instead of picking from a hardcoded dropdown, and you can switch between them with `Cmd+M`.
- **The output reads like you wrote it.** The optional human writing rules strip em dashes, AI-sounding words ("crucial", "leverage", "delve") and filler phrases. In messages they also remove openers like "Quick question:" and turn numbered questions into normal sentences. Your tone and language stay as they are.
- **You can add your own rules.** Put a one-line rule in the preferences or point it at a Markdown style guide.

## Commands

- **Fix Writing**: shows the fixed text next to the original. Press `Enter` to paste it over your selection, `Cmd+R` to retry, `Cmd+M` to switch model.
- **Fix Writing Instantly**: no preview, replaces the selection right away with the first model. Good for a hotkey.
- **Clean up Text**: for text copied from a terminal. Removes the extra left indent and joins hard-wrapped lines back into sentences, while keeping lists, blank lines and code blocks. Runs in code without AI, so it is instant and never changes a word. Use it only on wrapped text, since on normal text it can merge lines you meant to keep apart.

## Pasting and the clipboard fallback

All three commands put the result back the same way. Before pasting, the extension asks macOS (through the accessibility API) what kind of element has focus in the app you selected the text in:

| Focused element | What happens |
| --- | --- |
| Text field, text area or editable web content | The result is pasted over your selection |
| Read-only element, e.g. a label, list or button | The result is copied to the clipboard instead |
| Unclear, e.g. a web page or a custom control | The result is pasted and also copied, so it is never lost |
| Pasting fails | The result is copied to the clipboard |

A short message tells you which one happened. Turn on **Clipboard** in the preferences to copy every result as well. Copying replaces whatever was on your clipboard before.

Raycast needs accessibility access for this (System Settings > Privacy & Security > Accessibility). It already uses that permission to read your selected text.

## Setup

Needs Node 22+, pnpm and Raycast.

```sh
git clone https://github.com/unveroleone/raycast-fix-writing.git
cd raycast-fix-writing
pnpm install
pnpm dev
```

Wait for `built extension successfully`, then stop it with `Ctrl+C`. The extension stays in Raycast. On a new Mac this first `pnpm dev` is required, because it registers the extension with Raycast. After that, `pnpm build` is enough to update it.

Then set the preferences (Raycast Settings > Extensions > Fix Writing):

| Preference | Example |
| --- | --- |
| Provider Base URL | `https://api.openai.com/v1`, `https://api.deepseek.com/v1`, `https://openrouter.ai/api/v1`, `http://localhost:11434/v1` |
| API Key | your key, empty for Ollama or LM Studio |
| Models | `gpt-4o-mini, deepseek-chat` (first one is the default) |
| Proxy URL | `http://proxy.example.com:8080`, only needed on networks that block direct connections |
| Clipboard | off by default: also copy every result. Without it, the result is only copied when there is no text field to paste into or pasting fails |
| Writing Style | on by default: removes em dashes, AI-sounding words and filler |
| Extra Instructions | `Use Swiss spelling (ss instead of ß).` |
| Instructions File | a `.md` style guide for longer rules |

Assign hotkeys to the commands in Raycast Settings to use them from any app.
