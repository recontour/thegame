"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const AUDIO_SRC = "/universe/audio/newmain.mp3";

/** Soft organic ease into the corner */
const DOCK_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const DOCK_MS = 1000;

type AudioGateProps = {
  onUnlocked: () => void;
};

/**
 * Center 🎧 unlocks audio, then FLIP-animates into the top-left mute control.
 * Same DOM node the whole time — smooth, not choppy.
 */
export default function AudioGate({ onUnlocked }: AudioGateProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const firstRectRef = useRef<DOMRect | null>(null);
  /** True after the user has unlocked playback at least once */
  const unlockedRef = useRef(false);
  const mutedRef = useRef(false);
  /** We paused because the tab/app went away — safe to auto-resume */
  const pausedByBackgroundRef = useRef(false);

  const [phase, setPhase] = useState<"idle" | "flying" | "docked">("idle");
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onErr = () => {
      console.warn("[AudioGate] media error", el.error?.code);
      setError("Could not load audio file");
      setBusy(false);
    };
    el.addEventListener("error", onErr);
    return () => el.removeEventListener("error", onErr);
  }, []);

  /**
   * Pause BGM when the tab is hidden / app is backgrounded;
   * resume on return only if we paused for that reason and user isn’t muted.
   */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const pauseForBackground = () => {
      if (audio.paused) return;
      pausedByBackgroundRef.current = true;
      audio.pause();
    };

    const resumeIfNeeded = () => {
      if (!pausedByBackgroundRef.current) return;
      if (!unlockedRef.current || mutedRef.current) {
        pausedByBackgroundRef.current = false;
        return;
      }
      pausedByBackgroundRef.current = false;
      void audio.play().catch(() => {
        // Autoplay may still block; mute control remains available
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") pauseForBackground();
      else resumeIfNeeded();
    };

    document.addEventListener("visibilitychange", onVisibility);
    // iOS / some WebViews fire these when switching apps
    window.addEventListener("pagehide", pauseForBackground);
    window.addEventListener("pageshow", resumeIfNeeded);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", pauseForBackground);
      window.removeEventListener("pageshow", resumeIfNeeded);
    };
  }, []);

  // After React paints the docked layout, invert & ease home (FLIP)
  useLayoutEffect(() => {
    if (phase !== "flying") return;
    const btn = btnRef.current;
    const first = firstRectRef.current;
    if (!btn || !first) {
      setPhase("docked");
      return;
    }

    const last = btn.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / Math.max(1, last.width);
    const sy = first.height / Math.max(1, last.height);

    btn.style.transition = "none";
    btn.style.transformOrigin = "top left";
    btn.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

    // Next frame: release into the corner
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      btn.style.transition = "";
      btn.style.transform = "";
      btn.style.transformOrigin = "";
      firstRectRef.current = null;
      setPhase("docked");
    };

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        btn.style.transition = `transform ${DOCK_MS}ms ${DOCK_EASE}`;
        btn.style.transform = "translate(0px, 0px) scale(1, 1)";
      });
    });

    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "transform") return;
      btn.removeEventListener("transitionend", onEnd);
      finish();
    };
    btn.addEventListener("transitionend", onEnd);
    const fallback = window.setTimeout(finish, DOCK_MS + 100);

    return () => {
      cancelAnimationFrame(raf);
      btn.removeEventListener("transitionend", onEnd);
      clearTimeout(fallback);
    };
  }, [phase]);

  const handleStart = useCallback(async () => {
    if (busy || phase !== "idle") return;
    setBusy(true);
    setError(null);

    const audio = audioRef.current;
    const btn = btnRef.current;
    if (!audio) {
      setError("Player not ready");
      setBusy(false);
      return;
    }

    try {
      audio.loop = true;
      audio.muted = false;
      audio.volume = 1;
      await audio.play();

      unlockedRef.current = true;
      pausedByBackgroundRef.current = false;

      // Capture center position BEFORE React docks the button
      if (btn) firstRectRef.current = btn.getBoundingClientRect();

      setMuted(false);
      setBusy(false);
      onUnlocked();
      setPhase("flying"); // backdrop fades; button layout → corner + FLIP
    } catch (e) {
      console.warn("[AudioGate] play failed", e);
      setError("Tap again to enable sound");
      setBusy(false);
    }
  }, [busy, phase, onUnlocked]);

  const toggleMute = useCallback(() => {
    if (phase !== "docked") return;
    const audio = audioRef.current;
    if (!audio) return;
    const next = !audio.muted;
    audio.muted = next;
    setMuted(next);
    mutedRef.current = next;
    // Unmuting while still background-paused: try play
    if (!next && audio.paused && unlockedRef.current) {
      pausedByBackgroundRef.current = false;
      void audio.play().catch(() => {});
    }
  }, [phase]);

  const onButtonClick = () => {
    if (phase === "idle") void handleStart();
    else if (phase === "docked") toggleMute();
  };

  const showGateChrome = phase === "idle" || phase === "flying";

  return (
    <>
      <audio
        ref={audioRef}
        src={AUDIO_SRC}
        loop
        preload="auto"
        playsInline
      />

      {showGateChrome && (
        <div
          className={`audio-gate${phase === "flying" ? " is-fading" : ""}`}
          aria-hidden={phase !== "idle"}
        />
      )}

      {phase === "idle" && (
        <p className="audio-gate-hint audio-gate-hint--label u-p1">
          {error ?? (busy ? "Starting…" : "Tap to begin")}
        </p>
      )}

      <button
        ref={btnRef}
        type="button"
        className={[
          "audio-headphone-btn",
          phase === "idle" ? "is-center" : "is-docked",
          phase === "flying" ? "is-flying" : "",
          muted ? "is-muted" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onButtonClick}
        disabled={busy && phase === "idle"}
        aria-label={
          phase === "docked" ? (muted ? "Unmute" : "Mute") : "Play music"
        }
        aria-pressed={phase === "docked" ? muted : undefined}
      >
        <span className="audio-headphone-emoji" aria-hidden>
          {muted && phase === "docked" ? "🔇" : "🎧"}
        </span>
      </button>
    </>
  );
}
