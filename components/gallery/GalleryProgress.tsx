"use client";

type GalleryProgressProps = {
  index: number;
  total: number;
  visible?: boolean;
};

/**
 * Quiet bottom indicator — thin progress line + tiny index.
 */
export default function GalleryProgress({
  index,
  total,
  visible = true,
}: GalleryProgressProps) {
  const safeTotal = Math.max(total, 1);
  const progress = ((index + 1) / safeTotal) * 100;
  const label = `${String(index + 1).padStart(2, "0")}  /  ${String(safeTotal).padStart(2, "0")}`;

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: "fixed",
        left: "50%",
        bottom: "clamp(1.4rem, 4.5vh, 2.4rem)",
        transform: "translateX(-50%)",
        zIndex: 2,
        width: "min(42vw, 11rem)",
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.9s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.55rem",
      }}
    >
      <div
        style={{
          width: "100%",
          height: 1,
          background: "rgba(255,255,255,0.12)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${progress}%`,
            background: "rgba(255,255,255,0.45)",
            transition: "width 0.55s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
      <span
        style={{
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          fontSize: "0.62rem",
          letterSpacing: "0.22em",
          color: "rgba(255,255,255,0.38)",
          fontWeight: 400,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {label}
      </span>
    </div>
  );
}
