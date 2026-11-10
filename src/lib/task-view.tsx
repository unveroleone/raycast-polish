import { Action, ActionPanel, Detail, Icon, Keyboard, showToast, Toast } from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { deliver } from "./deliver";
import { getModels, isSwissGermanText, type Task, transformText } from "./llm";
import { readSelection } from "./selection";

const LABELS: Record<
  Task,
  { title: string; running: string; failed: string; done: string; paste: string; copy: string }
> = {
  fix: {
    title: "Fix Writing",
    running: "Fixing",
    failed: "Fix failed",
    done: "Text fixed",
    paste: "Paste Fixed Text",
    copy: "Copy Fixed Text",
  },
  shorten: {
    title: "Shorten Text",
    running: "Shortening",
    failed: "Shortening failed",
    done: "Text shortened",
    paste: "Paste Short Text",
    copy: "Copy Short Text",
  },
};

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

function toMarkdown(task: Task, result: string, original: string): string {
  // Two trailing spaces keep single line breaks visible in the markdown preview.
  const asLines = (s: string) => s.trim().replace(/\n/g, "  \n");
  const header =
    task === "shorten" ? `**Original** (${wordCount(original)} words, now ${wordCount(result)})` : "**Original**";
  return `${asLines(result)}\n\n---\n\n${header}\n\n${asLines(original)}`;
}

// Shared preview for the AI commands: reads the selection, streams the result and pastes it on Enter.
export function TaskView({ task }: { task: Task }) {
  const labels = LABELS[task];
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
      await deliver(result, labels.done);
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

    const toast = showToast({ style: Toast.Style.Animated, title: `${labels.running} with ${model}...` });

    const onUpdate = (partial: string) => {
      if (!controller.signal.aborted) setResult(partial);
    };

    transformText(original, model, task, { onUpdate, signal: controller.signal })
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
        t.title = labels.failed;
        t.message = e.message;
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => {
      controller.abort();
      toast.then((t) => t.hide());
    };
  }, [original, model, runId, task]);

  const markdown = error
    ? `**Error**\n\n${error}`
    : original !== undefined && result
      ? toMarkdown(task, result, original)
      : "";

  const canPaste = !isLoading && !error && result.length > 0;
  const title = [labels.title, original !== undefined && isSwissGermanText(original) && "Swiss German", model]
    .filter(Boolean)
    .join(" · ");

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      navigationTitle={title}
      actions={
        <ActionPanel>
          {canPaste && (
            <>
              <Action title={labels.paste} icon={Icon.Clipboard} onAction={pasteResult} />
              <Action.CopyToClipboard title={labels.copy} content={result} />
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
