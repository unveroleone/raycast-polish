import { Clipboard, closeMainWindow, getSelectedText, showHUD } from "@raycast/api";
import { cleanUpText } from "./lib/clean-up";

export default async function Command() {
  let text: string;
  try {
    text = await getSelectedText();
  } catch {
    await showHUD("No text selected");
    return;
  }
  if (!text.trim()) {
    await showHUD("No text selected");
    return;
  }

  await closeMainWindow();

  const cleaned = cleanUpText(text);
  if (cleaned === text) {
    await showHUD("Nothing to clean up");
    return;
  }
  await Clipboard.paste(cleaned);
  await showHUD("Text cleaned up");
}
