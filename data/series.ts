/**
 * Gallery series definitions.
 * Add new photos or entire series here — Scene/Gallery stay unchanged.
 *
 * Prefer space-free filenames under /public for mobile Safari reliability.
 */

export type Photo = {
  id: string;
  src: string;
  alt?: string;
};

export type Series = {
  id: string;
  title?: string;
  photos: Photo[];
};

/** Landing still (separate from gallery series). */
export const LANDING_HERO_SRC = "/hero.webp";

/**
 * Default series — first 8 frames from /public/photos.
 * Uses numeric filenames (copied from "1 (n).webp") for mobile-safe URLs.
 */
export const defaultSeries: Series = {
  id: "series-1",
  title: "Series I",
  photos: [
    { id: "p1", src: "/photos/1.webp" },
    { id: "p2", src: "/photos/2.webp" },
    { id: "p3", src: "/photos/3.webp" },
    { id: "p4", src: "/photos/4.webp" },
    { id: "p5", src: "/photos/5.webp" },
    { id: "p6", src: "/photos/6.webp" },
    { id: "p7", src: "/photos/7.webp" },
    { id: "p8", src: "/photos/8.webp" },
  ],
};

/** Registry for future multi-series support. */
export const seriesRegistry: Record<string, Series> = {
  [defaultSeries.id]: defaultSeries,
};

export function getSeries(id: string): Series {
  const series = seriesRegistry[id];
  if (!series) {
    throw new Error(`Unknown series: ${id}`);
  }
  return series;
}
