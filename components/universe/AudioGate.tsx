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

  const [phase, setPhase] = useState<"idle" | "flying" | "docked">("idle");
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <p className="audio-gate-hint audio-gate-hint--label">
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
