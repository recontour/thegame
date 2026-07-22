"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { Photo } from "@/data/series";
import {
  getMobileMaxTextureSize,
  loadMobileSafeTexture,
} from "@/components/gallery/loadMobileSafeTexture";

/** Session cache — keep all 8 textures in memory; never dispose on remount. */
const textureCache = new Map<string, THREE.Texture>();

const LOAD_GAP_MS = 220;

export type SeriesTexturesState = {
  textures: (THREE.Texture | null)[];
  /** True once at least one photo in the series is available */
  ready: boolean;
  /** True when sequential pass finished (success or skip) */
  complete: boolean;
  status: "idle" | "loading" | "ready" | "complete" | "error";
  error: string | null;
  loadedCount: number;
  loadingIndex: number | null;
  failed: string[];
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Sequential gallery texture loader for real mobile devices.
 * - One-by-one with a gap between loads
 * - Skip failures, continue
 * - Cache textures (do not dispose) for the session
 */
export function useSeriesTextures(
  photos: Photo[],
  enabled = true,
): SeriesTexturesState {
  const [textures, setTextures] = useState<(THREE.Texture | null)[]>(() =>
    photos.map((p) => textureCache.get(p.src) ?? null),
  );
  const [ready, setReady] = useState(() =>
    photos.some((p) => textureCache.has(p.src)),
  );
  const [complete, setComplete] = useState(false);
  const [status, setStatus] = useState<SeriesTexturesState["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(
    () => photos.filter((p) => textureCache.has(p.src)).length,
  );
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const runId = useRef(0);

  const key = photos.map((p) => p.src).join("|");

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setLoadingIndex(null);
      return;
    }

    if (photos.length === 0) {
      setReady(true);
      setComplete(true);
      setStatus("complete");
      return;
    }

    const id = ++runId.current;
    let cancelled = false;

    // Hydrate from cache immediately
    const initial = photos.map((p) => textureCache.get(p.src) ?? null);
    setTextures(initial);
    const cachedCount = initial.filter(Boolean).length;
    setLoadedCount(cachedCount);
    if (cachedCount > 0) {
      setReady(true);
      setStatus("ready");
    }
    if (cachedCount === photos.length) {
      setComplete(true);
      setStatus("complete");
      console.log("[series] all textures already cached", cachedCount);
      return;
    }

    const maxSize = getMobileMaxTextureSize();
    setStatus("loading");
    setError(null);
    console.log(
      "[series] sequential load start",
      photos.length,
      "cached",
      cachedCount,
      "maxSize",
      maxSize,
    );

    (async () => {
      const results = [...initial];
      const fails: string[] = [];
      let count = cachedCount;

      for (let i = 0; i < photos.length; i++) {
        if (cancelled || runId.current !== id) return;

        const photo = photos[i];
        const cached = textureCache.get(photo.src);
        if (cached) {
          results[i] = cached;
          setTextures([...results]);
          continue;
        }

        setLoadingIndex(i);
        console.log(`[series] loading ${i + 1}/${photos.length}`, photo.src);

        try {
          const tex = await loadMobileSafeTexture(photo.src, {
            maxSize,
            onLog: (e) => console.log(`[series:${i}]`, e.stage, e.detail ?? ""),
          });

          if (cancelled || runId.current !== id) {
            // Keep texture in cache even if this effect was superseded
            textureCache.set(photo.src, tex);
            return;
          }

          textureCache.set(photo.src, tex);
          results[i] = tex;
          count += 1;
          setTextures([...results]);
          setLoadedCount(count);
          setReady(true);
          setStatus("ready");
          console.log(
            `[series] ok ${i + 1}/${photos.length}`,
            photo.src,
            `(${count} loaded)`,
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(
            `[series] FAIL ${i + 1}/${photos.length} — skip`,
            photo.src,
            err,
          );
          fails.push(photo.src);
          setFailed([...fails]);
          setError(message);
          results[i] = null;
          setTextures([...results]);
          // continue to next — do not break gallery
        }

        // Gap between loads to avoid memory spikes on real phones
        if (i < photos.length - 1) {
          await sleep(LOAD_GAP_MS);
        }
      }

      if (cancelled || runId.current !== id) return;

      setLoadingIndex(null);
      setComplete(true);
      setStatus(count > 0 ? "complete" : "error");
      console.log(
        "[series] sequential pass done",
        count,
        "/",
        photos.length,
        "failed",
        fails.length,
      );
    })();

    return () => {
      cancelled = true;
      // Intentionally do NOT dispose textures — keep session cache.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return {
    textures,
    ready,
    complete,
    status,
    error,
    loadedCount,
    loadingIndex,
    failed,
  };
}
