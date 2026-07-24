"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import gsap from "gsap";
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

const FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * Landing story:
 * blank → welcome text in → glass pieces in → swipe assemble → exit → Gal / Work.
 *
 * Text is pure DOM (CSS opacity/transform) — free on mobile GPU.
 * WebGL only runs the shatter plane; intro reveal is a float uniform.
 */
export default function LandingExperience() {
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dpr, setDpr] = useState<number | [number, number]>(1);
  // DOM-driven intro (0..1) — GSAP mutates refs, React state for text chrome only
  // Avoid key name `text` — GSAP TextPlugin reserves it.
  const introRef = useRef({ welcome: 0, pieces: 0 });
  const piecesSnappedRef = useRef(false);
  const [textIn, setTextIn] = useState(0);

  const [webglError, setWebglError] = useState<string | null>(null);

  const getIntroReveal = useCallback(() => introRef.current.pieces, []);

  /** User scrolled — finish the smoke-in now so the story never feels stuck. */
  const snapPiecesIn = useCallback(() => {
    if (piecesSnappedRef.current) return;
    if (introRef.current.pieces >= 0.98) {
      piecesSnappedRef.current = true;
      return;
    }
    piecesSnappedRef.current = true;
    gsap.killTweensOf(introRef.current, "pieces");
    gsap.to(introRef.current, {
      pieces: 1,
      duration: 0.55,
      ease: "power2.out",
    });
  }, []);

  const { texture, status } = useTextureLoader(LANDING_HERO_SRC);
  const { uiProgress, tick, getProgress } = useLandingProgress({
    disabled: reduced,
    locked: false, // never freeze the page — scroll always works
    onScrollIntent: snapPiecesIn,
  });

  useEffect(() => {
    setMounted(true);
    const motionOff = prefersReducedMotion();
    setReduced(motionOff);
    setMobile(isMobileDevice());
    setDpr(getMobileDpr());

    if (motionOff) {
      introRef.current.welcome = 1;
      introRef.current.pieces = 1;
      piecesSnappedRef.current = true;
      setTextIn(1);
      return;
    }

    // blank → text → pieces smoke over 10s (always alive, no dead wait)
    // early scroll → snap pieces to full visibility and continue
    const state = introRef.current;
    state.welcome = 0;
    state.pieces = 0;
    piecesSnappedRef.current = false;
    setTextIn(0);

    const tl = gsap.timeline({
      defaults: { ease: "power2.out" },
    });

    // 1) Welcome text after a short black beat
    tl.to(
      state,
      {
        welcome: 1,
        duration: 1.15,
        ease: "power3.out",
        onUpdate: () => setTextIn(state.welcome),
      },
      0.3,
    );

    // 2) Seed a little visibility so the first shards are on-screen ASAP,
    //    then a true 10s linear travel bottom → final rest (wall-clock = duration)
    tl.set(state, { pieces: 0.04 }, 0.2);
    tl.to(
      state,
      {
        pieces: 1,
        duration: 10,
        ease: "none", // linear — feels like a full 10s, not ~6s with ease-in-out
      },
      0.2,
    );

    return () => {
      tl.kill();
      gsap.killTweensOf(state);
    };
  }, []);

  // Scroll-linked exit for welcome (DOM only — no extra GPU work)
  const titleLeave = reduced ? 0 : 1 - smoothstep(0.05, 0.3, uiProgress);
  const bodyLeave = reduced ? 0 : 1 - smoothstep(0.08, 0.38, uiProgress);

  const titleOpacity = textIn * titleLeave;
  const bodyOpacity = textIn * bodyLeave;
  const welcomeAlive = titleOpacity > 0.02 || bodyOpacity > 0.02;

  const ctaOpacity = reduced ? 1 : smoothstep(0.72, 0.9, uiProgress);
  const ctaInteractive = ctaOpacity > 0.45;

  const showCanvas = mounted && !reduced && !webglError;
  const heroStillOpacity = reduced ? 0.9 : 0;

  // Intro rise + scroll leave (title slightly ahead of body)
  const textEnterY = (1 - textIn) * 18;
  const titleScrollY = (1 - titleLeave) * -32;
  const bodyScrollY = (1 - bodyLeave) * -40;
  const titleScale = 1 - (1 - titleLeave) * 0.05;
  const titleTracking = 0.08 + (1 - titleLeave) * 0.12;

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
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 430,
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
                <ShatterPlane
                  texture={texture}
                  getProgress={getProgress}
                  getIntroReveal={getIntroReveal}
                />
              )}
            </Canvas>
          </WebGLErrorBoundary>
        )}

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

        {/* Welcome + manifesto — blank first, then CSS-composited in/out */}
        <div
          aria-hidden={!welcomeAlive}
          style={{
            position: "absolute",
            top: "6%",
            left: 0,
            right: 0,
            zIndex: 10,
            textAlign: "left",
            padding: "0 1.25rem 0 1rem", // ~pl-4 left, light right inset
            pointerEvents: "none",
            maxHeight: "58%",
            overflow: "hidden",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: FONT,
              fontSize: "clamp(1.25rem, 5vw, 1.5rem)",
              fontWeight: 400,
              letterSpacing: `${titleTracking}em`,
              lineHeight: 1.35,
              color: "rgba(255,255,255,0.92)",
              opacity: titleOpacity,
              transform: `translate3d(0, ${textEnterY + titleScrollY}px, 0) scale(${titleScale})`,
              willChange: "opacity, transform",
            }}
          >
            Welcome to my page
          </h1>
          <div
            style={{
              margin: "1.25rem 0 0",
              maxWidth: "100%",
              fontFamily: FONT,
              fontSize: "clamp(0.88rem, 3.4vw, 1rem)",
              fontWeight: 400,
              letterSpacing: "0.015em",
              lineHeight: 1.62,
              color: "rgba(255,255,255,0.62)",
              opacity: bodyOpacity,
              transform: `translate3d(0, ${textEnterY * 1.1 + bodyScrollY}px, 0)`,
              willChange: "opacity, transform",
            }}
          >
            <p style={{ margin: "0 0 0.75em" }}>Everyone wants to be seen.</p>
            <p style={{ margin: "0 0 0.75em" }}>
              Some chase money. Some chase fame.
            </p>
            <p style={{ margin: "0 0 0.75em" }}>
              In the long pursuit of our own dreams, we stop noticing the small
              things that quietly keep the world standing.
            </p>
            <p style={{ margin: "0 0 0.75em" }}>
              I am not trying to photograph success.
            </p>
            <p style={{ margin: "0 0 0.75em" }}>
              These are moments that almost never get a camera pointed at them;
              the people who carry the weight, take the risk, and still go
              unnamed.
            </p>
            <p style={{ margin: 0 }}>
              I hope these photographs make you look at them with respect
              instead of looking past them.
            </p>
          </div>
        </div>

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
            transform: `translate3d(0, ${(1 - ctaOpacity) * 16}px, 0)`,
            transition: reduced ? "none" : "opacity 0.2s linear",
          }}
        >
          <p
            style={{
              margin: "0 0 0.5rem",
              fontFamily: FONT,
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
              fontFamily: FONT,
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
              fontFamily: FONT,
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
      </div>
    </div>
  );
}
