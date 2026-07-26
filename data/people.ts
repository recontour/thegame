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
};

function card(
  n: number,
  title: string,
  body: string,
  quote: string,
  attribution?: string,
): StoryCard {
  return {
    id: `people-${n}`,
    src: `/people/${n}.webp`,
    title,
    body,
    quote,
    attribution,
  };
}

/** Exactly 12 cards — order is the swipe loop. */
export const PEOPLE_CARDS: StoryCard[] = [
  card(
    1,
    "Mountain Motorcycle Rider",
    "Some men carry the city.\nSome men remind the city it can still breathe.\nHe is not escaping.\nHe is remembering.",
    "“The only way to deal with an unfree world is to become so absolutely free that your very existence is an act of rebellion.”",
    "— Albert Camus",
  ),
  card(
    2,
    "City Bicycle Commuter",
    "Freedom gets the photograph.\nRoutine gets the living.\nHe is not less free.\nHe is simply closer to the cost of staying upright.",
    "“The privilege of a lifetime is being who you are.”",
    "— Joseph Campbell",
  ),
  card(
    3,
    "Perspective Sculpture",
    "Most people will never rotate the frame.\nThey will walk past the boy who is walking on the wall.\nThe light is real.\nThe ground is not.",
    "“We don’t see things as they are, we see them as we are.”",
    "— Anaïs Nin",
  ),
  card(
    4,
    "Man Washing Clothes in Dirty Pond",
    "This is the body they pretend to want\nuntil they realise it comes without the washing machine, the protein shake, or the soft life.\nHe does not sculpt.\nHe survives.",
    "“Poverty is the parent of revolution and crime.”",
    "— Aristotle",
  ),
  card(
    5,
    "Man Bathing in the River",
    "Some baths are taken to look good.\nThis one is taken to feel human again.\nThe river does not ask what he earns.\nIt only asks if he can stand in it.",
    "“In the depth of winter, I finally learned that within me there lay an invincible summer.”",
    "— Albert Camus",
  ),
  card(
    6,
    "Shepherd with Torn Umbrella",
    "A rich man would have thrown it away.\nThis man made it into a roof.\nThe umbrella is broken.\nThe shade is not.",
    "“Barn’s burnt down —\nnow I can see the moon.”",
    "— Mizuta Masahide",
  ),
  card(
    7,
    "Man with Crutch at the Cart",
    "The body is incomplete.\nThe day is not.\nHe does not ask the street for mercy.\nHe asks it for customers.",
    "“What is to give light must endure burning.”",
    "— Viktor Frankl",
  ),
  card(
    8,
    "Clothes Rack Carrier",
    "He carries what the city will wear tomorrow,\nand the city still walks past him like he is furniture.\nThey call it labor.\nHe treats it like a responsibility.",
    "“The labour of the poor is the wealth of the rich.”",
  ),
  card(
    9,
    "Stilt Clown",
    "We call it entertainment.\nHe calls it Tuesday.\nThe face is painted so the real one can stay private\nwhile the body works.",
    "“All the world’s a stage,\nAnd all the men and women merely players.”",
    "— William Shakespeare",
  ),
  card(
    10,
    "Construction Workers at Sunset",
    "They risk the fall\nso someone else can own the view.\nThe skyline is made of men\nno one will ever name.",
    "“The working class is not a class that needs to be liberated.\nIt is a class that needs to be recognised.”",
  ),
  card(
    11,
    "Elderly Man Sitting",
    "He has already carried his share.\nNow he only has to carry the afternoon.\nThe body is still here.\nThat is the whole story.",
    "“The years between fifty and seventy are the hardest.\nYou are always being asked to do things,\nand yet you are not decrepit enough to turn them down.”",
    "— T.S. Eliot",
  ),
  card(
    12,
    "Rock Fishing Couple",
    "Some people need an audience.\nThese two only needed each other on the rock.\nThe sea does not care who you love.\nBut loving someone makes the sea easier to stand in front of.",
    "“We are all in the same boat, in a stormy sea,\nand we owe each other a terrible loyalty.”",
    "— G.K. Chesterton",
  ),
];

export const PEOPLE_COUNT = PEOPLE_CARDS.length;
