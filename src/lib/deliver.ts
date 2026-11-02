import { Clipboard, closeMainWindow, getPreferenceValues, showHUD } from "@raycast/api";
import { execFile } from "child_process";

type Target = "editable" | "readonly" | "unknown";

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
  if elementRole is in {"AXStaticText", "AXScrollArea", "AXList", "AXTable", "AXOutline", "AXImage", "AXButton", "AXLink", "AXWindow"} then return "readonly"
  return "unknown"
end tell`;

function focusedTarget(): Promise<Target> {
  return new Promise((resolve) => {
    execFile("osascript", ["-e", FOCUS_SCRIPT], { timeout: 2000 }, (error, stdout) => {
      const result = stdout?.trim();
      resolve(!error && (result === "editable" || result === "readonly") ? result : "unknown");
    });
  });
}

// Pastes the text over the selection. Falls back to the clipboard when there is no text field to paste into or the
// paste fails. When the target cannot be detected, it pastes and copies, so the text is never lost.
export async function deliver(text: string, doneMessage: string): Promise<void> {
  const { alwaysCopy } = getPreferenceValues<Preferences>();

  await closeMainWindow();
  const target = await focusedTarget();

  if (target === "readonly") {
    await Clipboard.copy(text);
    await showHUD(`${doneMessage}. No text field to paste into, copied to clipboard`);
    return;
  }

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

  await showHUD(copy ? `${doneMessage}. Also copied to clipboard` : doneMessage);
}
