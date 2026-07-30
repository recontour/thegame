"use client";

type MoonIntroOverlayProps = {
  visible: boolean;
  onContinue: () => void;
};

const NASA_IMAGE = "/universe/photos/nasamoonandearth.webp";
const NASA_LINK =
  "https://www.nasa.gov/image-detail/amf-art002e009285/";

/**
 * Full-stage overlay (like audio gate) before the Moon placement beat.
 */
export default function MoonIntroOverlay({
  visible,
  onContinue,
}: MoonIntroOverlayProps) {
  if (!visible) return null;

  return (
    <div
      className="moon-intro-overlay"
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
          onClick={onContinue}
        >
          Okay, let&apos;s try.
        </button>
      </div>
    </div>
  );
}
