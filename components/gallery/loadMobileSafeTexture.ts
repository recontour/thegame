import * as THREE from "three";

export type TextureLoadLog = {
  src: string;
  stage: "start" | "image-ok" | "resized" | "ready" | "error";
  detail?: string;
};

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const touch =
    "ontouchstart" in window ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  const small = Math.min(window.innerWidth, window.innerHeight) < 820;
  return /iPhone|iPad|iPod|Android/i.test(ua) || Boolean(touch && small);
}

/**
 * Max edge length for GPU upload.
 * Cap protects real phones from black textures; desktop can go higher for print-sharp stills.
 */
export function getMobileMaxTextureSize(): number {
  return isMobileDevice() ? 1280 : 2048;
}

export function getMobileDpr(): number | [number, number] {
  return isMobileDevice() ? 1 : [1, 1.5];
}

function nextPowerOfTwo(n: number): number {
  let v = 1;
  while (v < n) v <<= 1;
  return v;
}

/**
 * Load an image, optionally downscale on a canvas, return a mobile-safe Texture.
 * Uses crossOrigin + explicit onLoad/onError logging.
 */
export function loadMobileSafeTexture(
  src: string,
  options?: {
    maxSize?: number;
    onLog?: (log: TextureLoadLog) => void;
  },
): Promise<THREE.Texture> {
  const maxSize = options?.maxSize ?? getMobileMaxTextureSize();
  const onLog = options?.onLog;

  const log = (stage: TextureLoadLog["stage"], detail?: string) => {
    const entry = { src, stage, detail };
    onLog?.(entry);
    if (stage === "error") {
      console.error("[texture]", entry);
    } else {
      console.log("[texture]", entry);
    }
  };

  return new Promise((resolve, reject) => {
    log("start", `maxSize=${maxSize}`);

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width;
        const naturalH = img.naturalHeight || img.height;
        log("image-ok", `${naturalW}x${naturalH}`);

        if (!naturalW || !naturalH) {
          const err = new Error(`Image has zero dimensions: ${src}`);
          log("error", err.message);
          reject(err);
          return;
        }

        const scale = Math.min(1, maxSize / Math.max(naturalW, naturalH));
        let w = Math.max(1, Math.round(naturalW * scale));
        let h = Math.max(1, Math.round(naturalH * scale));

        // Some older GLES drivers are happier with even dimensions
        w = w - (w % 2);
        h = h - (h % 2);
        w = Math.max(2, w);
        h = Math.max(2, h);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) {
          const err = new Error("2d canvas context unavailable");
          log("error", err.message);
          reject(err);
          return;
        }

        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, w, h);
        // High-quality downsample for portfolio stills
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        log(
          "resized",
          `${naturalW}x${naturalH} → ${w}x${h} (scale=${scale.toFixed(3)})`,
        );

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = 1;
        tex.flipY = true;
        tex.premultiplyAlpha = false;
        tex.needsUpdate = true;

        // Keep a handle for aspect without relying on ImageBitmap quirks
        tex.userData = {
          ...(tex.userData || {}),
          width: w,
          height: h,
          src,
        };

        log("ready", `canvas texture ${w}x${h}`);
        resolve(tex);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log("error", message);
        reject(e instanceof Error ? e : new Error(message));
      }
    };

    img.onerror = () => {
      const message = `Image failed to load: ${src}`;
      log("error", message);
      reject(new Error(message));
    };

    // Absolute URL helps some WebViews resolve relative paths
    try {
      const absolute =
        typeof window !== "undefined"
          ? new URL(src, window.location.href).href
          : src;
      img.src = absolute;
    } catch {
      img.src = src;
    }
  });
}

/** Apply the standard mobile-safe filter flags to any texture. */
export function applyMobileTextureFlags(tex: THREE.Texture): void {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 1;
  tex.needsUpdate = true;
}

export { isMobileDevice, nextPowerOfTwo };
