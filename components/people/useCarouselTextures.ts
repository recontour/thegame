"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { loadMobileSafeTexture } from "@/components/gallery/loadMobileSafeTexture";
import type { StoryCapability } from "@/components/people/capability";
import type { StoryCard } from "@/data/people";

export type SlotTexture = {
  texture: THREE.Texture | null;
  quality: "high" | "low" | "none";
  status: "idle" | "loading" | "ready" | "error";
};

/**
 * Lazy GPU textures: only current ± highNeighbor get high-res;
 * a slightly wider ring keeps low-res placeholders; rest stay unloaded.
 * Disposes textures that leave the window — critical on mid-range Android.
 */
export function useCarouselTextures(
  cards: StoryCard[],
  activeIndex: number,
  cap: StoryCapability,
): SlotTexture[] {
  const n = cards.length;
  const [slots, setSlots] = useState<SlotTexture[]>(() =>
    cards.map(() => ({ texture: null, quality: "none", status: "idle" })),
  );

  const owned = useRef<Map<string, THREE.Texture>>(new Map());
  const loading = useRef<Set<string>>(new Set());
  const gen = useRef(0);

  useEffect(() => {
    const myGen = ++gen.current;
    const ownedMap = owned.current;
    const loadingSet = loading.current;
    const want = new Map<number, "high" | "low">();

    for (let i = 0; i < n; i++) {
      const d = wrappedDelta(i, activeIndex, n);
      const ad = Math.abs(d);
      if (ad <= cap.highNeighborRadius) want.set(i, "high");
      else if (ad <= cap.lowNeighborRadius) want.set(i, "low");
    }

    // Dispose textures that left the window
    for (const [key, tex] of ownedMap) {
      const [idxStr, qual] = key.split(":");
      const idx = Number(idxStr);
      const needed = want.get(idx);
      if (!needed || needed !== (qual as "high" | "low")) {
        tex.dispose();
        ownedMap.delete(key);
      }
    }

    for (const [idx, quality] of want) {
      const key = `${idx}:${quality}`;
      if (ownedMap.has(key) || loadingSet.has(key)) continue;

      const maxSize = quality === "high" ? cap.highTexSize : cap.lowTexSize;
      loadingSet.add(key);

      setSlots((prev) => {
        const next = [...prev];
        next[idx] = {
          texture: ownedMap.get(key) ?? null,
          quality,
          status: "loading",
        };
        return next;
      });

      loadMobileSafeTexture(cards[idx].src, { maxSize })
        .then((tex) => {
          loadingSet.delete(key);
          if (myGen !== gen.current) {
            tex.dispose();
            return;
          }
          if (want.get(idx) !== quality) {
            tex.dispose();
            return;
          }
          ownedMap.set(key, tex);
          setSlots((prev) => {
            const next = [...prev];
            next[idx] = { texture: tex, quality, status: "ready" };
            return next;
          });
        })
        .catch(() => {
          loadingSet.delete(key);
          if (myGen !== gen.current) return;
          setSlots((prev) => {
            const next = [...prev];
            next[idx] = { texture: null, quality: "none", status: "error" };
            return next;
          });
        });
    }

    setSlots((prev) =>
      cards.map((_, i) => {
        const quality = want.get(i);
        if (!quality) {
          return {
            texture: null,
            quality: "none" as const,
            status: "idle" as const,
          };
        }
        const key = `${i}:${quality}`;
        const tex = ownedMap.get(key) ?? null;
        if (tex) {
          return { texture: tex, quality, status: "ready" as const };
        }
        return prev[i]?.quality === quality
          ? prev[i]
          : { texture: null, quality, status: "loading" as const };
      }),
    );
  }, [activeIndex, cards, n, cap]);

  useEffect(() => {
    const ownedMap = owned.current;
    const loadingSet = loading.current;
    return () => {
      gen.current += 1;
      for (const tex of ownedMap.values()) tex.dispose();
      ownedMap.clear();
      loadingSet.clear();
    };
  }, []);

  return slots;
}

/** Shortest signed distance on a ring of length n, result in (-n/2, n/2]. */
export function wrappedDelta(i: number, active: number, n: number): number {
  let d = i - active;
  d = ((d % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
}
