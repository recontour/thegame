"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const AUDIO_SRC = "/universe/audio/newmain.mp3";

/** Slow, smooth organic ease into the top-left corner */
const DOCK_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const DOCK_MS = 1250;

type AudioGateProps = {
  onUnlocked: () => void;
};

/**
 * Landing intro gate with two audio choices.
 * Clicking EITHER button slowly animates the selected button directly into the
 * persistent top-left mute control via FLIP animation, while the intro fades.
 */
export default function AudioGate({ onUnlocked }: AudioGateProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dockedBtnRef = useRef<HTMLButtonElement | null>(null);
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
    window.addEventListener("pagehide", pauseForBackground);
    window.addEventListener("pageshow", resumeIfNeeded);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", pauseForBackground);
      window.removeEventListener("pageshow", resumeIfNeeded);
    };
  }, []);

  // After React paints the docked top-left button, invert & ease home (FLIP)
  useLayoutEffect(() => {
    if (phase !== "flying") return;
    const dockedBtn = dockedBtnRef.current;
    const first = firstRectRef.current;
    if (!dockedBtn || !first) {
      setPhase("docked");
      return;
    }

    const last = dockedBtn.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = first.width / Math.max(1, last.width);
    const sy = first.height / Math.max(1, last.height);

    dockedBtn.style.transition = "none";
    dockedBtn.style.transformOrigin = "top left";
    dockedBtn.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      dockedBtn.style.transition = "";
      dockedBtn.style.transform = "";
      dockedBtn.style.transformOrigin = "";
      firstRectRef.current = null;
      setPhase("docked");
    };

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dockedBtn.style.transition = `transform ${DOCK_MS}ms ${DOCK_EASE}`;
        dockedBtn.style.transform = "translate(0px, 0px) scale(1, 1)";
      });
    });

    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== "transform") return;
      dockedBtn.removeEventListener("transitionend", onEnd);
      finish();
    };
    dockedBtn.addEventListener("transitionend", onEnd);
    const fallback = window.setTimeout(finish, DOCK_MS + 100);

    return () => {
      cancelAnimationFrame(raf);
      dockedBtn.removeEventListener("transitionend", onEnd);
      clearTimeout(fallback);
    };
  }, [phase]);

  const handleStart = useCallback(
    async (withSound: boolean, e: React.MouseEvent<HTMLButtonElement>) => {
      if (busy || phase !== "idle") return;
      setBusy(true);
      setError(null);

      const audio = audioRef.current;
      if (!audio) {
        setError("Player not ready");
        setBusy(false);
        return;
      }

      // Capture exact position of whichever button was clicked BEFORE phase changes
      const targetBtn = e.currentTarget;
      if (targetBtn) {
        firstRectRef.current = targetBtn.getBoundingClientRect();
      }

      try {
        audio.loop = true;
        audio.muted = !withSound;
        audio.volume = 1;
        await audio.play();

        unlockedRef.current = true;
        pausedByBackgroundRef.current = false;

        setMuted(!withSound);
        setBusy(false);
        onUnlocked();
        setPhase("flying"); // backdrop fades; button FLIP animates to top-left corner
      } catch (err) {
        console.warn("[AudioGate] play failed", err);
        setError("Tap again to begin");
        setBusy(false);
      }
    },
    [busy, phase, onUnlocked]
  );

  const toggleMute = useCallback(() => {
    if (phase !== "docked") return;
    const audio = audioRef.current;
    if (!audio) return;
    const next = !audio.muted;
    audio.muted = next;
    setMuted(next);
    mutedRef.current = next;
    if (!next && audio.paused && unlockedRef.current) {
      pausedByBackgroundRef.current = false;
      void audio.play().catch(() => {});
    }
  }, [phase]);

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
        >
          {phase === "idle" && (
            <div className="audio-gate-content">
              <div className="audio-gate-header">
                <h1 className="audio-gate-title u-h1">THE UNIVERSE</h1>
                <p className="audio-gate-desc u-p1">
                  A journey from the phone in your hand to the edge of the solar system. Ready to lose your sense of scale?
                </p>
              </div>

              {error && (
                <p className="audio-gate-error u-p1">{error}</p>
              )}

              <div className="audio-gate-btn-group">
                <div className="audio-choice-column">
                  <button
                    type="button"
                    className="audio-headphone-circle-btn primary"
                    onClick={(e) => handleStart(true, e)}
                    disabled={busy}
                    aria-label="Start with Audio"
                  >
                    <span className="audio-headphone-emoji" aria-hidden>
                      🎧
                    </span>
                  </button>
                  <span className="audio-choice-main">Start with Audio</span>
                  <span className="audio-choice-sub">Best experienced with headphones</span>
                </div>

                <div className="audio-choice-column">
                  <button
                    type="button"
                    className="audio-headphone-circle-btn secondary"
                    onClick={(e) => handleStart(false, e)}
                    disabled={busy}
                    aria-label="Start Muted"
                  >
                    <span className="audio-headphone-emoji" aria-hidden>
                      🔇
                    </span>
                  </button>
                  <span className="audio-choice-main">Start Muted</span>
                  <span className="audio-choice-sub">Play in silence</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        ref={dockedBtnRef}
        type="button"
        className={[
          "audio-headphone-btn",
          "is-docked",
          phase === "flying" ? "is-flying" : "",
          muted ? "is-muted" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={toggleMute}
        style={{
          display: phase === "docked" || phase === "flying" ? "flex" : "none",
        }}
        aria-label={muted ? "Unmute" : "Mute"}
        aria-pressed={muted}
      >
        <span className="audio-headphone-emoji" aria-hidden>
          {muted ? "🔇" : "🎧"}
        </span>
      </button>
    </>
  );
}
