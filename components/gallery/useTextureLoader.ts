"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";

export type TextureLoadState = {
  texture: THREE.Texture | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
};

/**
 * Manual texture load (no Suspense). Safe on mobile — surfaces errors instead of hanging.
 */
export function useTextureLoader(src: string | null): TextureLoadState {
  const [state, setState] = useState<TextureLoadState>({
    texture: null,
    status: src ? "loading" : "idle",
    error: null,
  });

  useEffect(() => {
    if (!src) {
      setState({ texture: null, status: "idle", error: null });
      return;
    }

    let cancelled = false;
    let owned: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();

    setState({ texture: null, status: "loading", error: null });

    loader.load(
      src,
      (tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = 1;
        tex.needsUpdate = true;
        owned = tex;
        setState({ texture: tex, status: "ready", error: null });
      },
      undefined,
      (err) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : `Failed to load texture: ${src}`;
        console.error("[texture]", src, err);
        setState({ texture: null, status: "error", error: message });
      },
    );

    return () => {
      cancelled = true;
      owned?.dispose();
      owned = null;
    };
  }, [src]);

  return state;
}
