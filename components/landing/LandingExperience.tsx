"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { Monsieur_La_Doulaise, Tangerine } from "next/font/google";
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

/** Script display — manifesto body. */
const tangerine = Tangerine({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

/** Script display — heading (raconteur line). */
const monsieur = Monsieur_La_Doulaise({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

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

const UI_FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

const MANIFESTO_LINES = [
  "Everyone wants to be seen.",
  "Some chase money. Some chase fame.",
  "In the long pursuit of our own dreams, we stop noticing the small things that quietly keep the world standing.",
  "I am not trying to photograph success.",
  "These are moments that almost never get a camera pointed at them; the people who carry the weight, take the risk, and still go unnamed.",
  "I hope these photographs make you look at them with respect instead of looking past them.",
] as const;

/**
 * Landing story:
 * blank → type reveal → glass pieces → swipe assemble → exit → Gal / Work.
 *
 * Text: GSAP stagger on DOM (opacity + translate3d only) — free vs WebGL.
 */
export default function LandingExperience() {
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dpr, setDpr] = useState<number | [number, number]>(1);

  // pieces intro only (0..1) — avoid key name `text` (GSAP TextPlugin)
  const introRef = useRef({ pieces: 0 });
  const piecesSnappedRef = useRef(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const titleLeadRef = useRef<HTMLSpanElement>(null);
  const titleTagRef = useRef<HTMLSpanElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  /** Copy bottom as fraction of stage height from top — cheap, not per-frame. */
  const textClearFromTopRef = useRef(0.5);

  const [webglError, setWebglError] = useState<string | null>(null);

  const getIntroReveal = useCallback(() => introRef.current.pieces, []);
  const getTextClearFromTop = useCallback(
    () => textClearFromTopRef.current,
    [],
  );

  /** One rect read — safe on resize / font load; does not run in the render loop. */
  const measureTextClear = useCallback(() => {
    const stage = stageRef.current;
    const copy = copyRef.current;
    if (!stage || !copy) return;
    const sr = stage.getBoundingClientRect();
    if (sr.height < 1) return;
    const cr = copy.getBoundingClientRect();
    const ratio = (cr.bottom - sr.top) / sr.height;
    // Tiny pad under last line — pieces can sit closer without covering glyphs
    textClearFromTopRef.current = Math.min(0.78, Math.max(0.28, ratio + 0.008));
  }, []);

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
    locked: false,
    onScrollIntent: snapPiecesIn,
  });

  useEffect(() => {
    measureTextClear();
    const onResize = () => measureTextClear();
    window.addEventListener("resize", onResize);
    const t1 = window.setTimeout(measureTextClear, 120);
    const t2 = window.setTimeout(measureTextClear, 600);
    void document.fonts?.ready?.then(() => measureTextClear());
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [measureTextClear]);

  useEffect(() => {
    setMounted(true);
    const motionOff = prefersReducedMotion();
    setReduced(motionOff);
    setMobile(isMobileDevice());
    setDpr(getMobileDpr());

    // Fonts / first paint may shift copy height
    measureTextClear();
    requestAnimationFrame(() => measureTextClear());

    const state = introRef.current;
    const titleLead = titleLeadRef.current;
    const titleTag = titleTagRef.current;
    const lines = lineRefs.current.filter(Boolean) as HTMLParagraphElement[];

    if (motionOff) {
      state.pieces = 1;
      piecesSnappedRef.current = true;
      if (titleLead) gsap.set(titleLead, { opacity: 1, y: 0, clearProps: "transform" });
      if (titleTag) gsap.set(titleTag, { opacity: 1, y: 0, clearProps: "transform" });
      if (lines.length) gsap.set(lines, { opacity: 1, y: 0, clearProps: "transform" });
      return;
    }

    state.pieces = 0;
    piecesSnappedRef.current = false;

    if (titleLead) gsap.set(titleLead, { opacity: 0, y: 14 });
    if (titleTag) gsap.set(titleTag, { opacity: 0, y: 14 });
    if (lines.length) gsap.set(lines, { opacity: 0, y: 16 });

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    // 1) "raconteur"
    if (titleLead) {
      tl.to(
        titleLead,
        {
          opacity: 1,
          y: 0,
          duration: 1.6,
          ease: "power2.out",
        },
        0.35,
      );
    }

    // 2) After 2s hold — "for those who care"
    if (titleTag) {
      tl.to(
        titleTag,
        {
          opacity: 1,
          y: 0,
          duration: 1.6,
          ease: "power2.out",
        },
        "+=2",
      );
    }

    // 3) Manifesto — default 2s between lines; 3s after the longer paragraphs
    if (lines.length) {
      const gapBefore = [0, 2, 2, 3, 2, 3];
      tl.addLabel("manifesto", ">");
      let t = 0;
      lines.forEach((line, i) => {
        t += gapBefore[i] ?? 2;
        tl.to(
          line,
          {
            opacity: 1,
            y: 0,
            duration: 1.1,
            ease: "power2.out",
          },
          `manifesto+=${t}`,
        );
      });
    }

    // 4) Pieces: visible ASAP at bottom, true 10s linear travel to rest
    tl.set(state, { pieces: 0.04 }, 0.2);
    tl.to(
      state,
      {
        pieces: 1,
        duration: 10,
        ease: "none",
      },
      0.2,
    );

    return () => {
      tl.kill();
      gsap.killTweensOf(state);
      if (titleLead) gsap.killTweensOf(titleLead);
      if (titleTag) gsap.killTweensOf(titleTag);
      if (lines.length) gsap.killTweensOf(lines);
    };
  }, []);

  // Scroll leave — one soft block (cheap; no per-line work on scroll)
  const copyLeave = reduced ? 1 : 1 - smoothstep(0.05, 0.36, uiProgress);
  const copyScrollY = (1 - copyLeave) * -36;
  const welcomeAlive = copyLeave > 0.02;

  const ctaOpacity = reduced ? 1 : smoothstep(0.72, 0.9, uiProgress);
  const ctaInteractive = ctaOpacity > 0.45;

  const showCanvas = mounted && !reduced && !webglError;
  const heroStillOpacity = reduced ? 0.9 : 0;

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
        ref={stageRef}
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
                  getTextClearFromTop={getTextClearFromTop}
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

        {/* Copy — GSAP intro on nodes; scroll leave is one wrapper fade.
            No maxHeight/overflow clip — that was cutting the last manifesto line. */}
        <div
          ref={copyRef}
          aria-hidden={!welcomeAlive}
          style={{
            position: "absolute",
            top: "8%",
            left: 0,
            right: 0,
            zIndex: 10,
            textAlign: "left",
            padding: "0 1.25rem 1.25rem 1rem",
            pointerEvents: "none",
            opacity: copyLeave,
            transform: `translate3d(0, ${copyScrollY}px, 0)`,
            willChange: "opacity, transform",
          }}
        >
          <h1
            className={monsieur.className}
            style={{
              // Match stage top: 8% — dvh so gap is height-based
              margin: "0 0 8dvh",
              fontSize: "clamp(2.35rem, 9.5vw, 3.1rem)",
              fontWeight: 400,
              letterSpacing: `${0.02 + (1 - copyLeave) * 0.06}em`,
              lineHeight: 1.15,
              color: "#ffffff",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.12em",
            }}
          >
            <span
              ref={titleLeadRef}
              style={{
                display: "block",
                opacity: reduced ? 1 : 0,
                willChange: "opacity, transform",
              }}
            >
              raconteur
            </span>
            <span
              ref={titleTagRef}
              style={{
                display: "block",
                fontSize: "0.92em",
                opacity: reduced ? 1 : 0,
                willChange: "opacity, transform",
              }}
            >
              for those who care
            </span>
          </h1>
          <div
            className={tangerine.className}
            style={{
              margin: 0,
              maxWidth: "100%",
              fontSize: "clamp(1.55rem, 5.8vw, 1.9rem)",
              fontWeight: 400,
              letterSpacing: "0.02em",
              lineHeight: 1.42,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            {MANIFESTO_LINES.map((line, i) => (
              <p
                key={line}
                ref={(el) => {
                  lineRefs.current[i] = el;
                }}
                style={{
                  margin: i === MANIFESTO_LINES.length - 1 ? 0 : "0 0 0.28em",
                  opacity: reduced ? 1 : 0,
                  willChange: "opacity, transform",
                }}
              >
                {line}
              </p>
            ))}
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
              fontFamily: UI_FONT,
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
              fontFamily: UI_FONT,
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
              fontFamily: UI_FONT,
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
