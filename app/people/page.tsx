import type { Metadata } from "next";
import StoryCarousel from "@/components/people/StoryCarousel";

export const metadata: Metadata = {
  title: "People",
  description: "A dreamy floating carousel — swipe through twelve stills.",
};

/**
 * Portrait-only WebGL story: void, stars, twelve drifting cards.
 * Desktop is letterboxed to a tall mobile frame.
 *
 * StoryCarousel is a Client Component — no next/dynamic ssr:false needed
 * (disallowed in Server Components on Next 16).
 */
export default function PeoplePage() {
  return <StoryCarousel />;
}
