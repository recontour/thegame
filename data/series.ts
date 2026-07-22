/**
 * Gallery series definitions.
 * `src` = full-resolution (centered hero)
 * `thumb` = lightweight collage background piece
 */

export type Photo = {
  id: string;
  /** Full-resolution image for the focused center frame */
  src: string;
  /** Thumbnail for collage background mess */
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
 * Default series — first 8 frames from /public/photos.
 */
export const defaultSeries: Series = {
  id: "series-1",
  title: "Series I",
  photos: [1, 2, 3, 4, 5, 6, 7, 8].map(photo),
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
