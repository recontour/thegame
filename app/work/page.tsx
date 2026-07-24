"use client";

import Link from "next/link";

/**
 * Fresh work interface — greenfield.
 * No WebGL / collage imports yet; keeps this route light until we build it.
 */
export default function WorkPage() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000000",
        color: "#ffffff",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 390,
          minHeight: "min(100dvh, 844px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2rem",
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: "0.68rem",
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.38)",
          }}
        >
          Work
        </p>
        <p
          style={{
            margin: 0,
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: "0.9rem",
            letterSpacing: "0.04em",
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.55)",
            maxWidth: "16rem",
          }}
        >
          New interface lives here. Blank canvas for now.
        </p>
        <Link
          href="/"
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: "0.68rem",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.42)",
            textDecoration: "none",
          }}
        >
          Back
        </Link>
      </div>
    </div>
  );
}
