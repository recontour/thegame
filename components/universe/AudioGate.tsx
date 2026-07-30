"use client";

import { useCallback, useRef, useState } from "react";

const AUDIO_SRC = "/universe/audio/landingsound.mp3";

type AudioGateProps = {
  /** Called once music has successfully started */
  onUnlocked: () => void;
};

/**
 * First-load modal: round 🎧 button unlocks looping BGM.
 * Web (esp. iOS) needs a direct user gesture to start audio.
 * Audio element stays mounted after unlock so the loop keeps going.
 */
export default function AudioGate({ onUnlocked }: AudioGateProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const handleStart = useCallback(async () => {
    if (busy || unlocked) return;
    setBusy(true);
    setError(false);

    const audio = audioRef.current;
    if (!audio) {
      setBusy(false);
      return;
    }

    try {
      audio.loop = true;
      audio.volume = 0.7;
      // Same user gesture: load + play (iOS-friendly)
      audio.load();
      await audio.play();
      setUnlocked(true);
      onUnlocked();
    } catch (e) {
      console.warn("[AudioGate] play failed", e);
      setError(true);
      setBusy(false);
    }
  }, [busy, unlocked, onUnlocked]);

  return (
    <>
      <audio
        ref={audioRef}
        src={AUDIO_SRC}
        loop
        preload="auto"
        playsInline
        style={{ display: "none" }}
      />

      {!unlocked && (
        <div
          className="audio-gate"
          role="dialog"
          aria-modal="true"
          aria-label="Enable sound"
        >
          <button
            type="button"
            className="audio-gate-btn"
            onClick={handleStart}
            disabled={busy}
            aria-label="Play music"
          >
            <span className="audio-gate-emoji" aria-hidden>
              🎧
            </span>
          </button>
          <p className="audio-gate-hint">
            {error ? "Tap again to enable sound" : "Tap to begin"}
          </p>
        </div>
      )}
    </>
  );
}
