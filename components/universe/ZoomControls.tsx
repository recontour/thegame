"use client";

type ZoomControlsProps = {
  visible: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  /** Show “Zoom out first.” under the buttons */
  showZoomHint?: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onConfirm: () => void;
};

/**
 * + / − zoom and Confirm — styles from app/universe/universe.css
 */
export default function ZoomControls({
  visible,
  canZoomIn,
  canZoomOut,
  showZoomHint = true,
  onZoomIn,
  onZoomOut,
  onConfirm,
}: ZoomControlsProps) {
  if (!visible) return null;

  return (
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
      {showZoomHint && <p className="zoom-hint">Zoom out first.</p>}
      <p className="zoom-fineprint">
        * the moon will appear once you confirm
      </p>
    </div>
  );
}
