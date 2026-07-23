/**
 * Gallery series definitions.
 * `src` = full-resolution (optional; collage currently uses thumbs)
 * `thumb` = collage piece
 */

export type Photo = {
  id: string;
  src: string;
  thumb: string;
  alt?: string;
};

export type Series = {
  id: string;
  title?: string;
  photos: Photo[];
};

/** Landing still (separate from gallery series). */
export const LANDING_HERO_SRC = "/hero.webp";

function photo(n: number): Photo {
  return {
    id: `p${n}`,
    src: `/photos/${n}.webp`,
    thumb: `/photos/thumbs/${n}.webp`,
  };
}

/**
 * Full series — all 12 frames live in the collage.
 * Each photo appears exactly once.
 */
export const defaultSeries: Series = {
  id: "series-1",
  title: "Series I",
  photos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(photo),
};

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
