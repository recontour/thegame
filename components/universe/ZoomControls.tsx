"use client";

type ZoomControlsProps = {
  visible: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  showMidCopy?: boolean;
  midTitle?: string;
  midFineprint?: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onConfirm: () => void;
};

/**
 * Optional mid-screen guidance + bottom − / + / Confirm bar.
 */
export default function ZoomControls({
  visible,
  canZoomIn,
  canZoomOut,
  showMidCopy = true,
  midTitle = "You might want to zoom out first.",
  midFineprint = "* You can move the moon once you confirm",
  onZoomIn,
  onZoomOut,
  onConfirm,
}: ZoomControlsProps) {
  if (!visible) return null;

  return (
    <>
      {showMidCopy && (
        <div className="zoom-mid-copy" aria-live="polite">
          <p className="zoom-mid-title">{midTitle}</p>
          {midFineprint ? (
            <p className="zoom-mid-fineprint">{midFineprint}</p>
          ) : null}
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
