"use client";

import { useEffect, useState } from "react";

type EntryGateProps = {
  /** Called once on first pointer down (touch + mouse). */
  onEnter: () => void;
  /** When true, gate fades out (Canvas may already be mounting underneath). */
  dismissing?: boolean;
};

/**
 * Pure black full-screen gate. No WebGL until the user taps/clicks.
 * Required for reliable mobile WebGL context creation.
 */
export default function EntryGate({ onEnter, dismissing = false }: EntryGateProps) {
  const [hintVisible, setHintVisible] = useState(false);
  const [tapped, setTapped] = useState(false);

  // Subtle "tap to enter" after 1s of black
  useEffect(() => {
    const id = window.setTimeout(() => setHintVisible(true), 1000);
    return () => window.clearTimeout(id);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only primary button / primary touch
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (tapped) return;

    e.preventDefault();
    setTapped(true);

    console.log("[EntryGate] first interaction registered", {
      pointerType: e.pointerType,
      time: performance.now().toFixed(0),
    });

    onEnter();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Tap to enter"
      onPointerDown={handlePointerDown}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!tapped) {
            setTapped(true);
            console.log("[EntryGate] keyboard enter");
            onEnter();
          }
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        width: "100%",
        height: "100dvh",
        minHeight: "100vh",
        background: "#000000",
        cursor: tapped ? "default" : "pointer",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        userSelect: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Seamless exit: fade gate after tap while Canvas boots underneath
        opacity: dismissing || tapped ? 0 : 1,
        transition: "opacity 0.85s ease",
        pointerEvents: dismissing || tapped ? "none" : "auto",
      }}
    >
      {/* Quiet hint — fades in after 1s */}
      <span
        style={{
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          fontSize: "0.7rem",
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          color: "rgba(255, 255, 255, 0.38)",
          fontWeight: 400,
          opacity: hintVisible && !tapped ? 1 : 0,
          transform: hintVisible && !tapped ? "translateY(0)" : "translateY(6px)",
          transition: "opacity 1.2s ease, transform 1.2s ease",
        }}
      >
        Tap to enter
      </span>

      {/* Temporary tap confirmation (top-left corner) */}
      {tapped && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 10,
            letterSpacing: "0.06em",
            color: "rgba(120, 255, 180, 0.75)",
            textShadow: "0 1px 2px #000",
            pointerEvents: "none",
          }}
        >
          enter ✓ · mounting WebGL…
        </div>
      )}
    </div>
  );
}
