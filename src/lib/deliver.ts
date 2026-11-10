import { Clipboard, closeMainWindow, getPreferenceValues, showHUD } from "@raycast/api";
import { execFile } from "child_process";

type Target = "editable" | "unknown";

// Asks the accessibility API whether the focused element of the frontmost app accepts text.
const FOCUS_SCRIPT = `
tell application "System Events"
  try
    set frontApp to first application process whose frontmost is true
    if name of frontApp is "Raycast" then return "unknown"
    set focusedElement to value of attribute "AXFocusedUIElement" of frontApp
    set elementRole to value of attribute "AXRole" of focusedElement
  on error
    return "unknown"
  end try
  if elementRole is in {"AXTextField", "AXTextArea", "AXComboBox", "AXSearchField"} then return "editable"
  try
    if value of attribute "AXEditableAncestor" of focusedElement is not missing value then return "editable"
  end try
  return "unknown"
end tell`;

function focusedTarget(): Promise<Target> {
  return new Promise((resolve) => {
    execFile("osascript", ["-e", FOCUS_SCRIPT], { timeout: 2000 }, (error, stdout) => {
      const result = stdout?.trim();
      resolve(!error && result === "editable" ? "editable" : "unknown");
    });
  });
}

// Always pastes over the selection. Editors with custom text views (Sublime Text, terminals, some Electron apps) do not
// report a text field to macOS, so a missing text field is no reason to skip the paste. Whenever the target is not a
// known text field, or the paste fails, the text is copied as well, so it is never lost.
export async function deliver(text: string, doneMessage: string): Promise<void> {
  const { alwaysCopy, statusMessages } = getPreferenceValues<Preferences>();

  await closeMainWindow();
  const target = await focusedTarget();

  const copy = alwaysCopy || target === "unknown";
  // Copy before pasting: paste may restore the previous clipboard afterwards, which then is our text.
  if (copy) await Clipboard.copy(text);

  try {
    await Clipboard.paste(text);
  } catch {
    if (!copy) await Clipboard.copy(text);
    await showHUD(`${doneMessage}. Could not paste, copied to clipboard`);
    return;
  }

  if (statusMessages) await showHUD(copy ? `${doneMessage}. Also copied to clipboard` : doneMessage);
}
