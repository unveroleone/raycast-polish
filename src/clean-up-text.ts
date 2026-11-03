import { closeMainWindow, showHUD } from "@raycast/api";
import { cleanUpText } from "./lib/clean-up";
import { deliver } from "./lib/deliver";
import { readSelection } from "./lib/selection";

export default async function Command() {
  const text = await readSelection();
  if (!text) {
    await showHUD("No text selected");
    return;
  }

  await closeMainWindow();

  const cleaned = cleanUpText(text);
  if (cleaned === text) {
    await showHUD("Nothing to clean up");
    return;
  }
  await deliver(cleaned, "Text cleaned up");
}
