/**
 * Landing story slides — 9:16 WebPs in public/landing.
 * Step 7 (index 6) is the shatter “about me” beat using /hero.webp.
 */

export type LandingSlide = {
  src: string;
  mode: "title" | "body";
  lines: string[];
};

export const LANDING_SLIDES: LandingSlide[] = [
  {
    src: "/landing/1.webp",
    mode: "title",
    lines: ["raconteur", "for those who care"],
  },
  {
    src: "/landing/2.webp",
    mode: "body",
    lines: [
      "Everyone wants to be seen.",
      "Some chase money. Some chase fame.",
    ],
  },
  {
    src: "/landing/3.webp",
    mode: "body",
    lines: [
      "In the long pursuit of our own dreams, we stop noticing the small things that quietly keep the world standing.",
    ],
  },
  {
    src: "/landing/4.webp",
    mode: "body",
    lines: ["I am not trying to photograph success."],
  },
  {
    src: "/landing/5.webp",
    mode: "body",
    lines: [
      "These are moments that almost never get a camera pointed at them",
      "The people who carry the weight, take the risk, and still go unnamed.",
    ],
  },
  {
    src: "/landing/6.webp",
    mode: "body",
    lines: [
      "I hope these photographs make you look at them with respect",
      "instead of looking past them.",
    ],
  },
];

/** Shatter hero for the 7th beat — portfolio hero portrait. */
export const LANDING_PIECES_HERO_SRC = "/hero.webp";

export const LANDING_SWAP_PHOTOS = LANDING_SLIDES.map((s) => s.src);

export const STORY_SLIDE_COUNT = LANDING_SLIDES.length;

/** Total continuous steps: 6 photos + 1 pieces beat */
export const TOTAL_STEPS = STORY_SLIDE_COUNT + 1;
