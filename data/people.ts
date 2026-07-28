/**
 * People — dreamy floating carousel content.
 * Image N.webp pairs with card index N (1-based filenames).
 */

export type StoryCard = {
  id: string;
  /** Full image path (optimized WebP, aim ≤200KB) */
  src: string;
  /** Short scene title */
  title: string;
  /** Body copy (line breaks preserved) */
  body: string;
  /** Quote line(s) */
  quote: string;
  /** Optional attribution under the quote */
  attribution?: string;
  /**
   * Full-bleed crop anchor (0 = left/top, 0.5 = center, 1 = right/bottom).
   * Used only while the image is immersive; settled layout is unchanged.
   */
  focusX?: number;
  focusY?: number;
  /**
   * Degrees of Z rotation while full-bleed (eases to 0 when settled).
   * Landscape that enters on its side: 90 or -90.
   */
  immerseRotate?: number;
  /**
   * Full-bleed scale vs edge-to-edge cover (1 = flush, <1 zooms out with margin).
   */
  immerseZoom?: number;
  /**
   * How full-bleed sizes the image:
   * - cover (default) — fills the stage, may crop
   * - height — image top & bottom meet the screen edges
   * - width — image left & right meet the screen edges
   */
  immerseFit?: "cover" | "height" | "width";
};

type CardOpts = {
  focusX?: number;
  focusY?: number;
  immerseRotate?: number;
  immerseZoom?: number;
  immerseFit?: "cover" | "height" | "width";
};

function card(
  n: number,
  title: string,
  body: string,
  quote: string,
  attribution?: string,
  opts?: CardOpts,
): StoryCard {
  return {
    id: `people-${n}`,
    src: `/people/${n}.webp`,
    title,
    body,
    quote,
    attribution,
    ...opts,
  };
}

/** Subject a touch right of center — full-bleed crop */
const RIGHT_30 = { focusX: 0.68 } as const;
/** Image 1 only — a bit further right than the shared right bias */
const RIGHT_1 = { focusX: 0.945, immerseZoom: 0.93 } as const;
/** Subject a little left of center */
const LEFT_A_BIT = { focusX: 0.4 } as const;
/** A clear step left */
const LEFT = { focusX: 0.36 } as const;

/** Exactly 12 cards — order is the swipe loop. */
export const PEOPLE_CARDS: StoryCard[] = [
  card(
    1,
    "The Remembering",
    "Some men carry the city.\nSome men remind the city it can still breathe.\nHe is not escaping.\nHe is remembering.",
    "“The only way to deal with an unfree world is to become so absolutely free that your very existence is an act of rebellion.”",
    "— Albert Camus",
    RIGHT_1,
  ),
  card(
    2,
    "The Cost of Upright",
    "Freedom gets the photograph.\nRoutine gets the living.\nHe is not less free.\nHe is simply closer to the cost of staying upright.",
    "“The privilege of a lifetime is being who you are.”",
    "— Joseph Campbell",
    // center — default
  ),
  card(
    3,
    "Walking the Wall",
    "Most people will never rotate the frame.\nThey will walk past the boy who is walking on the wall.\nThe light is real.\nThe ground is not.",
    "“We don’t see things as they are, we see them as we are.”",
    "— Anaïs Nin",
    // Landscape: enter on its side, fitted left→right, then settle upright
    { immerseRotate: -90, immerseFit: "width" },
  ),
  card(
    4,
    "Necessary Flesh",
    "This is the body they pretend to want\nuntil they realise it comes without the washing machine, the protein shake, or the soft life.\nHe does not sculpt.\nHe survives.",
    "“Poverty is the parent of revolution and crime.”",
    "— Aristotle",
  ),
  card(
    5,
    "Temporary Mercy",
    "Some baths are taken to look good.\nThis one is taken to feel human again.\nThe river does not ask what he earns.\nIt only asks if he can stand in it.",
    "“In the depth of winter, I finally learned that within me there lay an invincible summer.”",
    "— Albert Camus",
    // Slightly right of center; air top & bottom
    { focusX: 0.66, immerseZoom: 0.9 },
  ),
  card(
    6,
    "Useful Ruin",
    "A rich man would have thrown it away.\nThis man made it into a roof.\nThe umbrella is broken.\nThe shade is not.",
    "“Barn’s burnt down —\nnow I can see the moon.”",
    "— Mizuta Masahide",
    { focusX: 0.86 },
  ),
  card(
    7,
    "The Working Limb",
    "The body is incomplete.\nThe day is not.\nHe does not ask the street for mercy.\nHe asks it for customers.",
    "“What is to give light must endure burning.”",
    "— Viktor Frankl",
    { focusX: 0.32 },
  ),
  card(
    8,
    "Unnamed Shoulders",
    "He carries what the city will wear tomorrow,\nand the city still walks past him like he is furniture.\nThey call it labor.\nHe treats it like a responsibility.",
    "“The labour of the poor is the wealth of the rich.”",
    undefined,
    { focusX: 0.2, immerseZoom: 0.92 },
  ),
  card(
    9,
    "Painted Tuesday",
    "We call it entertainment.\nHe calls it Tuesday.\nThe face is painted so the real one can stay private\nwhile the body works.",
    "“All the world’s a stage,\nAnd all the men and women merely players.”",
    "— William Shakespeare",
    LEFT,
  ),
  card(
    10,
    "Risking the Fall",
    "They risk the fall\nso someone else can own the view.\nThe skyline is made of men\nno one will ever name.",
    "“The working class is not a class that needs to be liberated.\nIt is a class that needs to be recognised.”",
    undefined,
    { immerseZoom: 0.92 },
  ),
  card(
    11,
    "What Remains",
    "He has already carried his share.\nNow he only has to carry the afternoon.\nThe body is still here.\nThat is the whole story.",
    "“The years between fifty and seventy are the hardest.\nYou are always being asked to do things,\nand yet you are not decrepit enough to turn them down.”",
    "— T.S. Eliot",
    // Center crop, breathe — slight zoom-out leaves air top & bottom
    { immerseZoom: 0.86 },
  ),
  card(
    12,
    "The Anchor",
    "Some people need an audience.\nThese two only needed each other on the rock.\nThe sea does not care who you love.\nBut loving someone makes the sea easier to stand in front of.",
    "“We are all in the same boat, in a stormy sea,\nand we owe each other a terrible loyalty.”",
    "— G.K. Chesterton",
    { focusX: 0.78, immerseZoom: 0.92 },
  ),
];

export const PEOPLE_COUNT = PEOPLE_CARDS.length;
