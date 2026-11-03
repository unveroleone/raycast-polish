import { Action, ActionPanel, Detail, Icon, Keyboard, showToast, Toast } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { deliver } from "./lib/deliver";
import { fixText, getModels } from "./lib/llm";
import { readSelection } from "./lib/selection";

function toMarkdown(fixed: string, original: string): string {
  // Two trailing spaces keep single line breaks visible in the markdown preview.
  const asLines = (s: string) => s.trim().replace(/\n/g, "  \n");
  return `${asLines(fixed)}\n\n---\n\n**Original**\n\n${asLines(original)}`;
}

export default function Command() {
  const [models] = useState(() => {
    try {
      return getModels();
    } catch {
      return [];
    }
  });
  const [model, setModel] = useState(models[0] ?? "");
  const [original, setOriginal] = useState<string>();
  const [result, setResult] = useState("");
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [runId, setRunId] = useState(0);
  // Guards against pressing Enter twice, which would paste the text twice.
  const deliveringRef = useRef(false);

  const pasteResult = async () => {
    if (deliveringRef.current) return;
    deliveringRef.current = true;
    try {
      await deliver(result, "Text fixed");
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Could not paste", message: (e as Error).message });
    } finally {
      deliveringRef.current = false;
    }
  };

  useEffect(() => {
    readSelection()
      .then((text) => {
        if (!text) throw new Error("empty");
        setOriginal(text);
      })
      .catch(() => {
        setError("No text selected. Select some text in any app and run the command again.");
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (original === undefined) return;
    if (!model) {
      setError("No model configured. Add at least one model ID in the extension preferences.");
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    setIsLoading(true);
    setError(undefined);
    setResult("");

    const toast = showToast({ style: Toast.Style.Animated, title: `Fixing with ${model}...` });

    const onUpdate = (partial: string) => {
      if (!controller.signal.aborted) setResult(partial);
    };

    fixText(original, model, { onUpdate, signal: controller.signal })
      .then(async (fixed) => {
        if (controller.signal.aborted) return;
        setResult(fixed);
        (await toast).hide();
      })
      .catch(async (e: Error) => {
        if (controller.signal.aborted) return;
        setError(e.message);
        const t = await toast;
        t.style = Toast.Style.Failure;
        t.title = "Fix failed";
        t.message = e.message;
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => {
      controller.abort();
      toast.then((t) => t.hide());
    };
  }, [original, model, runId]);

  const markdown = error
    ? `**Error**\n\n${error}`
    : original !== undefined && result
      ? toMarkdown(result, original)
      : "";

  const canPaste = !isLoading && !error && result.length > 0;

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      navigationTitle={model ? `Fix Writing · ${model}` : "Fix Writing"}
      actions={
        <ActionPanel>
          {canPaste && (
            <>
              <Action title="Paste Fixed Text" icon={Icon.Clipboard} onAction={pasteResult} />
              <Action.CopyToClipboard title="Copy Fixed Text" content={result} />
            </>
          )}
          {original !== undefined && (
            <Action
              title="Retry"
              icon={Icon.Repeat}
              shortcut={Keyboard.Shortcut.Common.Refresh}
              onAction={() => setRunId((n) => n + 1)}
            />
          )}
          {original !== undefined && models.length > 1 && (
            <ActionPanel.Submenu title="Change Model" icon={Icon.Switch} shortcut={{ modifiers: ["cmd"], key: "m" }}>
              {models.map((m) => (
                <Action
                  key={m}
                  title={m}
                  icon={m === model ? Icon.CheckCircle : Icon.Circle}
                  onAction={() => (m === model ? setRunId((n) => n + 1) : setModel(m))}
                />
              ))}
            </ActionPanel.Submenu>
          )}
        </ActionPanel>
      }
    />
  );
}
