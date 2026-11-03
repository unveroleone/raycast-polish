import { getSelectedText } from "@raycast/api";

// Reading the selection copies it in the background, which some apps (Teams, other Electron apps) answer too slowly
// on the first try. Retry once after a short pause before giving up.
export async function readSelection(): Promise<string | undefined> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await getSelectedText();
      if (text.trim()) return text;
    } catch {
      // Try again below.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return undefined;
}
