"use client";

type ScrollProgressProps = {
  progress: number;
  visible?: boolean;
};

/**
 * Whisper-thin scroll progress — almost not there.
 */
export default function ScrollProgress({
  progress,
  visible = true,
}: ScrollProgressProps) {
  const p = Math.max(0, Math.min(1, progress));

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: "50%",
        bottom: "clamp(1.25rem, 4vh, 2rem)",
        transform: "translateX(-50%)",
        zIndex: 2,
        width: "min(28vw, 7.5rem)",
        height: 1,
        pointerEvents: "none",
        opacity: visible ? 0.9 : 0,
        transition: "opacity 1.2s ease",
        background: "rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${p * 100}%`,
          background: "rgba(255,255,255,0.38)",
          transition: "width 0.08s linear",
        }}
      />
    </div>
  );
}
