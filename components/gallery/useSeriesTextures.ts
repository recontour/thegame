"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import type { Photo } from "@/data/series";
import {
  getMobileMaxTextureSize,
  loadMobileSafeTexture,
} from "@/components/gallery/loadMobileSafeTexture";

export type SeriesTexturesState = {
  textures: (THREE.Texture | null)[];
  ready: boolean;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  loadedCount: number;
};

/**
 * Progressive series load — first photo, then the rest (never all in parallel on mobile).
 * Only runs when `enabled` is true (after hero is visible).
 */
export function useSeriesTextures(
  photos: Photo[],
  enabled = true,
): SeriesTexturesState {
  const [textures, setTextures] = useState<(THREE.Texture | null)[]>(() =>
    photos.map(() => null),
  );
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<SeriesTexturesState["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);

  const key = photos.map((p) => p.src).join("|");

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setStatus("idle");
      return;
    }

    if (photos.length === 0) {
      setTextures([]);
      setReady(true);
      setStatus("ready");
      return;
    }

    let cancelled = false;
    const owned: THREE.Texture[] = [];
    const results: (THREE.Texture | null)[] = photos.map(() => null);
    const maxSize = getMobileMaxTextureSize();

    setReady(false);
    setStatus("loading");
    setError(null);
    setLoadedCount(0);
    setTextures(photos.map(() => null));

    console.log("[series] start sequential load", photos.length, "maxSize", maxSize);

    (async () => {
      // 1) First image only — gallery can open once this exists
      try {
        const first = await loadMobileSafeTexture(photos[0].src, {
          maxSize,
          onLog: (e) => console.log("[series:0]", e),
        });
        if (cancelled) {
          first.dispose();
          return;
        }
        owned.push(first);
        results[0] = first;
        setTextures([...results]);
        setLoadedCount(1);
        setReady(true);
        setStatus("ready");
        console.log("[series] first photo ready — gallery can start");
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error("[series] first photo failed", err);
        setError(message);
        setStatus("error");
        setReady(false);
        return;
      }

      // 2) Remaining photos one-by-one (avoids mobile GPU memory spikes)
      for (let i = 1; i < photos.length; i++) {
        if (cancelled) return;
        try {
          const tex = await loadMobileSafeTexture(photos[i].src, {
            maxSize,
            onLog: (e) => console.log(`[series:${i}]`, e),
          });
          if (cancelled) {
            tex.dispose();
            return;
          }
          owned.push(tex);
          results[i] = tex;
          setTextures([...results]);
          setLoadedCount(i + 1);
        } catch (err) {
          console.error(`[series] photo ${i} failed`, photos[i].src, err);
          results[i] = null;
          setTextures([...results]);
        }
      }

      if (!cancelled) {
        console.log(
          "[series] complete",
          owned.length,
          "/",
          photos.length,
        );
      }
    })();

    return () => {
      cancelled = true;
      owned.forEach((t) => t.dispose());
      results.forEach((t) => {
        if (t && !owned.includes(t)) t.dispose();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { textures, ready, status, error, loadedCount };
}
