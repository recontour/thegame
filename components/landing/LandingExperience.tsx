"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  getMobileDpr,
  isMobileDevice,
} from "@/components/gallery/loadMobileSafeTexture";
import { useTextureLoader } from "@/components/gallery/useTextureLoader";
import { LANDING_HERO_SRC } from "@/data/series";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";
import ShatterPlane from "@/components/landing/ShatterPlane";
import {
  smoothstep,
  useLandingProgress,
} from "@/components/landing/useLandingProgress";

function ProgressBridge({
  tick,
}: {
  tick: (dt: number) => number;
}) {
  useFrame((_, dt) => {
    tick(dt);
  });
  return null;
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Landing story:
 * broken hero pile + welcome → swipe up assemble → swipe again exit → Gal / Work.
 */
export default function LandingExperience() {
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const dpr = useMemo(() => getMobileDpr(), []);
  const mobile = useMemo(() => isMobileDevice(), []);

  const { texture, status } = useTextureLoader(LANDING_HERO_SRC);
  const { uiProgress, tick, getProgress } = useLandingProgress({
    disabled: reduced,
  });

  const [webglError, setWebglError] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    // Allow first paint of DOM chrome, then mark ready for subtle fades
    const id = window.requestAnimationFrame(() => setBooted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  // UI opacities from story progress
  const welcomeOpacity = reduced
    ? 0
    : (1 - smoothstep(0.08, 0.38, uiProgress)) * (booted ? 1 : 0);
  const hintOpacity = reduced
    ? 0
    : (1 - smoothstep(0.05, 0.28, uiProgress)) *
      smoothstep(0.0, 0.12, uiProgress) *
      (status === "ready" ? 1 : 0.35);
  const heroStillOpacity = reduced ? 0.9 : 0;
  const ctaOpacity = reduced
    ? 1
    : smoothstep(0.72, 0.9, uiProgress);
  const ctaInteractive = ctaOpacity > 0.45;

  const showCanvas = !reduced && !webglError;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none",
        overflow: "hidden",
      }}
    >
      {/* Portrait stage — same vertical experience on phone + desktop */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: mobile ? "100%" : 430,
          height: "100dvh",
          minHeight: "100vh",
          background: "#000000",
          overflow: "hidden",
        }}
      >
        {showCanvas && (
          <WebGLErrorBoundary onError={setWebglError}>
            <Canvas
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                display: "block",
                background: "#000000",
                touchAction: "none",
              }}
              gl={{
                antialias: !mobile,
                alpha: false,
                powerPreference: "default",
                stencil: false,
                depth: true,
                failIfMajorPerformanceCaveat: false,
              }}
              dpr={dpr}
              camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 80 }}
              resize={{ scroll: false, debounce: 0 }}
              onCreated={({ gl }) => {
                gl.setClearColor("#000000", 1);
              }}
            >
              <color attach="background" args={["#000000"]} />
              <ProgressBridge tick={tick} />
              {texture && status === "ready" && (
                <ShatterPlane texture={texture} getProgress={getProgress} />
              )}
            </Canvas>
          </WebGLErrorBoundary>
        )}

        {/* Reduced-motion / WebGL fail: static hero */}
        {(reduced || webglError) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={LANDING_HERO_SRC}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: heroStillOpacity || (webglError ? 0.55 : 0.9),
              pointerEvents: "none",
            }}
          />
        )}

        {/* Welcome copy — top */}
        <div
          aria-hidden={welcomeOpacity < 0.05}
          style={{
            position: "absolute",
            top: "12%",
            left: 0,
            right: 0,
            zIndex: 10,
            textAlign: "center",
            padding: "0 1.75rem",
            pointerEvents: "none",
            opacity: welcomeOpacity,
            transform: `translateY(${(1 - welcomeOpacity) * -10}px)`,
            transition: reduced ? "none" : "opacity 0.2s linear",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
              fontSize: "0.62rem",
              letterSpacing: "0.42em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.38)",
              fontWeight: 400,
            }}
          >
            Ashwin
          </p>
          <h1
            style={{
              margin: "1.1rem 0 0",
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
              fontSize: "clamp(1.15rem, 4.2vw, 1.35rem)",
              fontWeight: 400,
              letterSpacing: "0.08em",
              lineHeight: 1.45,
              color: "rgba(255,255,255,0.88)",
            }}
          >
            Welcome to my page
          </h1>
        </div>

        {/* Swipe hint */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: "7%",
            left: 0,
            right: 0,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.55rem",
            pointerEvents: "none",
            opacity: hintOpacity,
            transition: "opacity 0.25s linear",
          }}
        >
          <span
            style={{
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
              fontSize: "0.62rem",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Swipe up
          </span>
          <span
            style={{
              width: 1,
              height: 28,
              background:
                "linear-gradient(to top, rgba(255,255,255,0.35), transparent)",
            }}
          />
        </div>

        {/* CTAs — after second beat */}
        <nav
          aria-label="Experiences"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.75rem",
            opacity: ctaOpacity,
            pointerEvents: ctaInteractive ? "auto" : "none",
            transform: `translateY(${(1 - ctaOpacity) * 16}px)`,
            transition: reduced ? "none" : "opacity 0.2s linear",
          }}
        >
          <p
            style={{
              margin: "0 0 0.5rem",
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
              fontSize: "0.62rem",
              letterSpacing: "0.36em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.34)",
            }}
          >
            Enter
          </p>
          <Link
            href="/gal"
            style={{
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
              fontSize: "0.82rem",
              letterSpacing: "0.42em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.82)",
              textDecoration: "none",
              padding: "0.75rem 1.5rem",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Gal
          </Link>
          <Link
            href="/work"
            style={{
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
              fontSize: "0.82rem",
              letterSpacing: "0.42em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.82)",
              textDecoration: "none",
              padding: "0.75rem 1.5rem",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Work
          </Link>
        </nav>

        {/* Loading whisper */}
        {showCanvas && status !== "ready" && status !== "error" && (
          <div
            style={{
              position: "absolute",
              bottom: 18,
              left: 18,
              zIndex: 30,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 10,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.28)",
              pointerEvents: "none",
            }}
          >
            loading
          </div>
        )}
      </div>
    </div>
  );
}
