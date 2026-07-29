"use client";

type ZoomControlsProps = {
  visible: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  /** Mid-screen zoom guidance (hidden at max zoom when top shows far-enough) */
  showMidCopy?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onConfirm: () => void;
};

/**
 * Mid-screen guidance + bottom − / + / Confirm bar.
 * Styles: app/universe/universe.css
 */
export default function ZoomControls({
  visible,
  canZoomIn,
  canZoomOut,
  showMidCopy = true,
  onZoomIn,
  onZoomOut,
  onConfirm,
}: ZoomControlsProps) {
  if (!visible) return null;

  return (
    <>
      {showMidCopy && (
        <div className="zoom-mid-copy" aria-live="polite">
          <p className="zoom-mid-title">
            You might want to zoom out to place our moon to where you think it
            is.
          </p>
          <p className="zoom-mid-fineprint">
            * You can move moon and place it once you confirm
          </p>
        </div>
      )}

      <div id="zoom-controls" role="group" aria-label="Zoom controls">
        <div className="zoom-controls-row">
          <button
            id="btn-minus"
            type="button"
            className="ctrl-btn square"
            disabled={!canZoomIn}
            onClick={onZoomIn}
            aria-label="Zoom in"
          >
            −
          </button>
          <button
            id="btn-plus"
            type="button"
            className="ctrl-btn square"
            disabled={!canZoomOut}
            onClick={onZoomOut}
            aria-label="Zoom out"
          >
            +
          </button>
          <button
            id="btn-confirm"
            type="button"
            className="ctrl-btn rect"
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </>
  );
}
