"use client";

import { useEffect, useState } from "react";

type MoonIntroOverlayProps = {
  visible: boolean;
  onContinue: () => void;
};

const NASA_IMAGE = "/universe/photos/nasamoonandearth.webp";
const NASA_LINK =
  "https://www.nasa.gov/image-detail/amf-art002e009285/";

/** Match CSS exit duration so we unmount after the fade completes */
const EXIT_MS = 900;

/**
 * Full-stage overlay before the Moon placement beat.
 * Soft enter/exit — stays mounted through the fade so it never hard-cuts.
 */
export default function MoonIntroOverlay({
  visible,
  onContinue,
}: MoonIntroOverlayProps) {
  const [mounted, setMounted] = useState(visible);
  const [shown, setShown] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setExiting(false);
      // Double rAF so the browser paints opacity 0 before we fade in
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }

    setShown(false);
    const t = window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [visible]);

  const handleContinue = () => {
    if (exiting) return;
    setExiting(true);
    setShown(false);
    // Parent starts the next beat only after the overlay has faded out
    window.setTimeout(() => {
      onContinue();
    }, EXIT_MS);
  };

  if (!mounted) return null;

  return (
    <div
      className={`moon-intro-overlay${shown && !exiting ? " is-visible" : ""}${
        exiting ? " is-exiting" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="About Moon photos"
    >
      <div className="moon-intro-card">
        <p className="moon-intro-copy">
          <strong>Most pictures lie.</strong>
          The usual images of Earth and the Moon
          {"\n"}
          squeeze them close so they fit on a page.
          {"\n"}
          That quiet compression slowly shrinks
          {"\n"}
          what we believe is possible.
        </p>

        <img
          className="moon-intro-photo"
          src={NASA_IMAGE}
          alt="Earth and Moon — NASA"
          draggable={false}
        />

        <p className="moon-intro-credit">
          ☝️ Image by NASA
          {" · "}
          <a
            href={NASA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="moon-intro-link"
          >
            More info
          </a>
        </p>

        <p className="moon-intro-copy moon-intro-cta-copy">
          Now try it yourself,
          {"\n"}
          place the Moon where you actually think it belongs.
        </p>

        <button
          type="button"
          className="ctrl-btn rect moon-intro-btn"
          onClick={handleContinue}
          disabled={exiting}
        >
          Okay, let&apos;s try.
        </button>
      </div>
    </div>
  );
}
