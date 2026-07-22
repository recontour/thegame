"use client";

type ContinueIndicatorProps = {
  visible: boolean;
};

export default function ContinueIndicator({ visible }: ContinueIndicatorProps) {
  return (
    <>
      <div
        aria-hidden={!visible}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "clamp(1.75rem, 5vh, 2.75rem)",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.55rem",
          pointerEvents: "none",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 1.4s ease, transform 1.4s ease",
        }}
      >
        <span
          style={{
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: "0.68rem",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.42)",
            fontWeight: 400,
          }}
        >
          Swipe
        </span>
        <span
          style={{
            width: 12,
            height: 12,
            borderRight: "1px solid rgba(255, 255, 255, 0.38)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.38)",
            transform: "rotate(45deg)",
            display: "block",
            animation: visible
              ? "continuePulse 2.4s ease-in-out infinite"
              : "none",
          }}
        />
      </div>
      <style>{`
        @keyframes continuePulse {
          0%, 100% {
            opacity: 0.35;
            transform: rotate(45deg) translateY(0);
          }
          50% {
            opacity: 0.7;
            transform: rotate(45deg) translateY(3px);
          }
        }
      `}</style>
    </>
  );
}
