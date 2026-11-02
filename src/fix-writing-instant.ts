import { Clipboard, closeMainWindow, getSelectedText, showHUD, showToast, Toast } from "@raycast/api";
import { fixText, getModels } from "./lib/llm";

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

  try {
    const model = getModels()[0];
    await showToast({ style: Toast.Style.Animated, title: `Fixing with ${model}...` });
    const fixed = await fixText(text, model);
    await Clipboard.paste(fixed);
    await showHUD(fixed === text ? "Already correct" : "Text fixed");
  } catch (error) {
    await showHUD(`Fix failed: ${(error as Error).message}`);
  }
}
