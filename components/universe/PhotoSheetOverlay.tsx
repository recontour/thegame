"use client";

import { useEffect, useState } from "react";

type PhotoSheetOverlayProps = {
  visible: boolean;
  onNext: () => void;
  imageSrc: string;
  imageAlt: string;
  creditHref: string;
  /** Shown after the ☝️ emoji */
  creditText?: string;
};

const EXIT_MS = 700;

/**
 * Full opaque photo sheet — NASA image + readable credit + Next.
 * Shared by Moon and Sun “wonder what it looks like” beats.
 */
export default function PhotoSheetOverlay({
  visible,
  onNext,
  imageSrc,
  imageAlt,
  creditHref,
  creditText = "Image by NASA",
}: PhotoSheetOverlayProps) {
  const [mounted, setMounted] = useState(visible);
  const [shown, setShown] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setExiting(false);
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

  const handleNext = () => {
    if (exiting) return;
    setExiting(true);
    setShown(false);
    window.setTimeout(() => {
      onNext();
    }, EXIT_MS);
  };

  if (!mounted) return null;

  return (
    <div
      className={`moon-photo-overlay${shown && !exiting ? " is-visible" : ""}${
        exiting ? " is-exiting" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={imageAlt}
    >
      <div className="moon-photo-card">
        <img
          className="moon-photo-img"
          src={imageSrc}
          alt={imageAlt}
          draggable={false}
        />
        <p className="moon-photo-credit u-p1">
          <span className="moon-photo-credit-emoji" aria-hidden>
            ☝️
          </span>
          <span>
            {creditText}
            {" · "}
            <a
              href={creditHref}
              target="_blank"
              rel="noopener noreferrer"
              className="moon-photo-link"
            >
              More info
            </a>
          </span>
        </p>
        <button
          type="button"
          className="ctrl-btn rect moon-photo-next"
          onClick={handleNext}
          disabled={exiting}
        >
          Next
        </button>
      </div>
    </div>
  );
}
