"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const AUDIO_SRC = "/universe/audio/landingsound.mp3";

type AudioGateProps = {
  /** Called once music has successfully started */
  onUnlocked: () => void;
};

/**
 * First-load 🎧 unlock + looping BGM.
 * IMPORTANT: this component must stay mounted after unlock — unmounting
 * kills the <audio> element and stops the music.
 */
export default function AudioGate({ onUnlocked }: AudioGateProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onErr = () => {
      const mediaErr = el.error;
      console.warn("[AudioGate] media error", mediaErr?.code, mediaErr?.message);
      setError("Could not load audio file");
      setBusy(false);
    };

    el.addEventListener("error", onErr);
    return () => el.removeEventListener("error", onErr);
  }, []);

  const handleStart = useCallback(async () => {
    if (busy || unlocked) return;
    setBusy(true);
    setError(null);

    const audio = audioRef.current;
    if (!audio) {
      setError("Player not ready");
      setBusy(false);
      return;
    }

    try {
      audio.loop = true;
      audio.muted = false;
      audio.volume = 1;

      // Do NOT call load() here — it can cancel play on some mobile browsers.
      // Just play() inside the user gesture.
      await audio.play();

      setUnlocked(true);
      setBusy(false);
      onUnlocked();
    } catch (e) {
      console.warn("[AudioGate] play failed", e);
      setError("Tap again to enable sound");
      setBusy(false);
    }
  }, [busy, unlocked, onUnlocked]);

  return (
    <>
      {/* Always mounted — survives after the gate UI hides */}
      <audio
        ref={audioRef}
        src={AUDIO_SRC}
        loop
        preload="auto"
        playsInline
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
            onClick={() => {
              void handleStart();
            }}
            disabled={busy}
            aria-label="Play music"
          >
            <span className="audio-gate-emoji" aria-hidden>
              🎧
            </span>
          </button>
          <p className="audio-gate-hint">
            {error ?? (busy ? "Starting…" : "Tap to begin")}
          </p>
        </div>
      )}
    </>
  );
}
