"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import {
  getMobileMaxTextureSize,
  loadMobileSafeTexture,
} from "@/components/gallery/loadMobileSafeTexture";

export type TextureLoadState = {
  texture: THREE.Texture | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  log: string;
};

/**
 * Mobile-safe texture load (no Suspense).
 * Downscales on canvas, crossOrigin anonymous, explicit onLoad/onError logs.
 */
export function useTextureLoader(src: string | null): TextureLoadState {
  const [state, setState] = useState<TextureLoadState>({
    texture: null,
    status: src ? "loading" : "idle",
    error: null,
    log: src ? "queued" : "idle",
  });

  useEffect(() => {
    if (!src) {
      setState({ texture: null, status: "idle", error: null, log: "idle" });
      return;
    }

    let cancelled = false;
    let owned: THREE.Texture | null = null;

    setState({
      texture: null,
      status: "loading",
      error: null,
      log: `loading ${src}`,
    });

    console.log("[useTextureLoader] start", src);

    loadMobileSafeTexture(src, {
      maxSize: getMobileMaxTextureSize(),
      onLog: (entry) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          log: `${entry.stage}${entry.detail ? `: ${entry.detail}` : ""}`,
        }));
      },
    })
      .then((tex) => {
        if (cancelled) {
          tex.dispose();
          return;
        }
        owned = tex;
        console.log("[useTextureLoader] ready", src, tex);
        setState({
          texture: tex,
          status: "ready",
          error: null,
          log: "ready",
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error("[useTextureLoader] error", src, err);
        setState({
          texture: null,
          status: "error",
          error: message,
          log: `error: ${message}`,
        });
      });

    return () => {
      cancelled = true;
      owned?.dispose();
      owned = null;
    };
  }, [src]);

  return state;
}
