import { useSession } from "@web-ai-sdk/prompt/react";
import { type ChangeEvent, useEffect, useState } from "react";
import { UnavailableHint } from "./UnavailableHint.js";

// Stable reference: an inline literal would recreate the session every render.
const EXPECTED_INPUTS = [{ type: "text" as const }, { type: "image" as const }];

/**
 * Live multimodal demo for `useSession`. Pick an image; the session receives
 * a text + image content-part message and streams back a description. The
 * `File` from the input is a `Blob`, a browser-native image value, and is
 * forwarded to the model as-is.
 */
export const SessionDemo = () => {
  const { status, session, error } = useSession({
    systemPrompt: "You describe images. Reply with one short sentence.",
    expectedInputs: EXPECTED_INPUTS,
  });

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<Error | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setOutput("");
    setSendError(null);
  };

  const describe = async () => {
    if (!session || !file) return;
    setBusy(true);
    setSendError(null);
    setOutput("");
    try {
      let buffer = "";
      for await (const delta of session.sendStreaming([
        {
          role: "user",
          content: [
            {
              type: "text",
              value: "Describe this image in one short sentence.",
            },
            { type: "image", value: file },
          ],
        },
      ])) {
        buffer += delta;
        setOutput(buffer);
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        setSendError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="demo-card">
      {status === "unavailable" && (
        <>
          <UnavailableHint
            api="Prompt API image input"
            chrome={
              <>
                Prompt API image input unavailable. Multimodal sessions need
                Chrome 148+ and a device that meets the current hardware
                requirements; see Browser support.
              </>
            }
            edge={
              <>
                Prompt API image input unavailable. Edge's preview does not
                serve image input yet; try desktop Chrome 148+.
              </>
            }
          />
          {error && <p className="demo-error">{error.message}</p>}
        </>
      )}
      <div className="demo-row">
        <input
          type="file"
          accept="image/*"
          onChange={onPick}
          className="demo-input"
          aria-label="image to describe"
          disabled={status === "unavailable"}
        />
        {busy ? (
          <button
            type="button"
            onClick={() => session?.abort()}
            className="demo-button"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={describe}
            disabled={status !== "ready" || !file}
            className="demo-button"
          >
            Describe
          </button>
        )}
      </div>
      {previewUrl && (
        <img src={previewUrl} alt="selected preview" className="demo-preview" />
      )}
      {sendError && <p className="demo-error">{sendError.message}</p>}
      {(output || busy) && (
        <article className="demo-response">
          <header className="demo-response__header">
            <span>{busy ? "Streaming…" : "Description"}</span>
            {output && !busy && (
              <button
                type="button"
                onClick={() => setOutput("")}
                className="demo-dismiss"
                aria-label="dismiss"
              >
                ×
              </button>
            )}
          </header>
          {output ? (
            <p className="demo-response__body">{output}</p>
          ) : (
            <p className="demo-muted">…</p>
          )}
        </article>
      )}
    </div>
  );
};
