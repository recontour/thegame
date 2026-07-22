"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import type { Photo } from "@/data/series";

export type SeriesTexturesState = {
  textures: (THREE.Texture | null)[];
  ready: boolean;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  loadedCount: number;
};

/**
 * Loads a series of textures with explicit dispose on unmount / src change.
 * Never hangs Suspense; reports partial/total failure for UI fallbacks.
 */
export function useSeriesTextures(photos: Photo[]): SeriesTexturesState {
  const [textures, setTextures] = useState<(THREE.Texture | null)[]>(() =>
    photos.map(() => null),
  );
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SeriesTexturesState["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);

  const key = photos.map((p) => p.src).join("|");

  useEffect(() => {
    if (photos.length === 0) {
      setTextures([]);
      setReady(true);
      setStatus("ready");
      return;
    }

    let cancelled = false;
    let owned: THREE.Texture[] = [];
    const loader = new THREE.TextureLoader();

    setReady(false);
    setStatus("loading");
    setError(null);
    setLoadedCount(0);
    setTextures(photos.map(() => null));

    let completed = 0;
    const results: (THREE.Texture | null)[] = photos.map(() => null);
    const failures: string[] = [];

    const finishIfDone = () => {
      if (cancelled || completed < photos.length) return;
      owned = results.filter((t): t is THREE.Texture => t != null);
      setTextures([...results]);
      setLoadedCount(owned.length);

      if (owned.length === 0) {
        setReady(false);
        setStatus("error");
        setError(failures[0] ?? "All series textures failed to load");
        return;
      }

      // Ready if at least first frame loaded (gallery can show; gaps skipped later)
      setReady(results[0] != null || owned.length > 0);
      setStatus(failures.length ? "error" : "ready");
      if (failures.length) {
        setError(
          `Loaded ${owned.length}/${photos.length}. ${failures[0] ?? ""}`.trim(),
        );
      }
    };

    photos.forEach((photo, i) => {
      loader.load(
        photo.src,
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
          results[i] = tex;
          completed += 1;
          setLoadedCount((c) => c + 1);
          finishIfDone();
        },
        undefined,
        (err) => {
          if (cancelled) return;
          console.error("[series texture]", photo.src, err);
          failures.push(photo.src);
          results[i] = null;
          completed += 1;
          finishIfDone();
        },
      );
    });

    return () => {
      cancelled = true;
      owned.forEach((t) => t.dispose());
      results.forEach((t) => t?.dispose());
      owned = [];
    };
    // key captures the photo src list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { textures, ready, status, error, loadedCount };
}
