"use client";

import { useCallback, useState } from "react";

type ThumbItem = {
  source: string;
  output?: string;
  ok: boolean;
  error?: string;
  width?: number;
  height?: number;
};

type ApiResponse = {
  ok: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  message?: string;
  items?: ThumbItem[];
  thumbsDir?: string;
};

export default function GenerateThumbsPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("Ready. Source: /public/photos");
  const [detail, setDetail] = useState<ApiResponse | null>(null);

  const run = useCallback(async () => {
    setStatus("loading");
    setMessage("Generating thumbnails…");
    setDetail(null);

    try {
      const res = await fetch("/api/generate-thumbs", { method: "POST" });
      const data = (await res.json()) as ApiResponse;

      if (!res.ok && !data.message) {
        throw new Error(`HTTP ${res.status}`);
      }

      setDetail(data);
      setStatus(data.ok ? "done" : data.succeeded > 0 ? "done" : "error");
      setMessage(data.message ?? (data.ok ? "Done." : "Finished with errors."));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus("error");
      setMessage(`Request failed: ${msg}`);
      setDetail(null);
    }
  }, []);

  const statusColor =
    status === "loading"
      ? "rgba(255,220,120,0.9)"
      : status === "error"
        ? "rgba(255,120,120,0.95)"
        : status === "done"
          ? "rgba(120,255,180,0.9)"
          : "rgba(255,255,255,0.45)";

  return (
    <main
      style={{
        minHeight: "100dvh",
        height: "100%",
        overflow: "auto",
        margin: 0,
        padding: "clamp(1.5rem, 4vw, 3rem)",
        background: "#000",
        color: "#eee",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        boxSizing: "border-box",
        touchAction: "auto",
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <p
          style={{
            margin: "0 0 0.35rem",
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.35)",
          }}
        >
          Dev tool
        </p>
        <h1
          style={{
            margin: "0 0 0.75rem",
            fontSize: "1.35rem",
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          Generate thumbnails
        </h1>
        <p
          style={{
            margin: "0 0 2rem",
            fontSize: 13,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.45)",
          }}
        >
          Reads <code style={{ color: "rgba(255,255,255,0.65)" }}>/public/photos</code>
          , writes max-width 600px WebP files to{" "}
          <code style={{ color: "rgba(255,255,255,0.65)" }}>
            /public/photos/thumbs
          </code>
          .
        </p>

        <button
          type="button"
          onClick={run}
          disabled={status === "loading"}
          style={{
            width: "100%",
            padding: "1rem 1.25rem",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 2,
            background:
              status === "loading" ? "rgba(255,255,255,0.06)" : "#111",
            color: "#fff",
            fontSize: 14,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: status === "loading" ? "wait" : "pointer",
            opacity: status === "loading" ? 0.7 : 1,
          }}
        >
          {status === "loading" ? "Working…" : "Generate Thumbnails"}
        </button>

        <p
          style={{
            margin: "1.25rem 0 0",
            fontSize: 13,
            lineHeight: 1.45,
            color: statusColor,
            minHeight: "1.4em",
          }}
          aria-live="polite"
        >
          {message}
        </p>

        {detail && (
          <div
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              fontSize: 12,
              lineHeight: 1.55,
              color: "rgba(255,255,255,0.55)",
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            }}
          >
            <div>
              processed: {detail.processed} · ok: {detail.succeeded} · failed:{" "}
              {detail.failed}
            </div>
            {detail.thumbsDir && <div>out: {detail.thumbsDir}</div>}
            {detail.items && detail.items.length > 0 && (
              <ul
                style={{
                  margin: "0.75rem 0 0",
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {detail.items.map((item) => (
                  <li
                    key={item.source}
                    style={{
                      marginBottom: 4,
                      color: item.ok
                        ? "rgba(180,255,200,0.75)"
                        : "rgba(255,140,140,0.9)",
                    }}
                  >
                    {item.ok
                      ? `✓ ${item.source} → ${item.output} (${item.width}×${item.height})`
                      : `✗ ${item.source}: ${item.error}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
