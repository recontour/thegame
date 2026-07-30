"use client";

import { Html } from "@react-three/drei";

type HomeMarkerProps = {
  /** Shown during the Sun distance lesson */
  visible: boolean;
};

/**
 * Screen-space Home indicator — fixed CSS size so zoom / AU snap never
 * shrinks it. Not scale-true; just “you are here.”
 */
export default function HomeMarker({ visible }: HomeMarkerProps) {
  if (!visible) return null;

  return (
    <Html
      position={[0, 0, 0]}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
      zIndexRange={[5, 0]}
      // Keep pixel size constant (don’t scale with camera distance)
      distanceFactor={undefined}
      transform={false}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 5,
        }}
      >
        {/* Tiny fixed-size glowing pin */}
        <div
          className="home-glow-pin"
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 35% 30%, #f0f8ff 0%, #7ec8ff 45%, #2a7ad4 100%)",
            boxShadow:
              "0 0 4px 1px rgba(140, 210, 255, 0.95), 0 0 10px 3px rgba(80, 160, 255, 0.65), 0 0 18px 6px rgba(50, 120, 255, 0.35)",
            animation: "home-pin-pulse 1.8s ease-in-out infinite",
          }}
        />
        <div
          style={{
            color: "rgba(180, 220, 255, 0.95)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            textShadow:
              "0 0 6px rgba(80, 160, 255, 0.85), 0 0 14px rgba(60, 140, 255, 0.45)",
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}
        >
          Home
        </div>
      </div>
      <style>{`
        @keyframes home-pin-pulse {
          0%, 100% {
            box-shadow:
              0 0 4px 1px rgba(140, 210, 255, 0.9),
              0 0 10px 3px rgba(80, 160, 255, 0.55),
              0 0 16px 5px rgba(50, 120, 255, 0.28);
            transform: scale(1);
          }
          50% {
            box-shadow:
              0 0 6px 2px rgba(160, 220, 255, 1),
              0 0 14px 5px rgba(90, 170, 255, 0.75),
              0 0 22px 8px rgba(60, 140, 255, 0.4);
            transform: scale(1.12);
          }
        }
      `}</style>
    </Html>
  );
}
