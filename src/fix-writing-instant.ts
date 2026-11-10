import { closeMainWindow, getPreferenceValues, showHUD, showToast, Toast } from "@raycast/api";
import { deliver } from "./lib/deliver";
import { getModels, transformText } from "./lib/llm";
import { readSelection } from "./lib/selection";

export default async function Command() {
  const text = await readSelection();
  if (!text) {
    await showHUD("No text selected");
    return;
  }

  await closeMainWindow();

  try {
    const model = getModels()[0];
    if (getPreferenceValues<Preferences>().statusMessages) {
      await showToast({ style: Toast.Style.Animated, title: `Fixing with ${model}...` });
    }
    const fixed = await transformText(text, model, "fix");
    await deliver(fixed, fixed === text ? "Already correct" : "Text fixed");
  } catch (error) {
    await showHUD(`Fix failed: ${(error as Error).message}`);
  }
}
