import type { Metadata } from "next";
import UniverseShell from "@/components/universe/UniverseShell";
import "./universe.css";

export const metadata: Metadata = {
  title: "Universe",
  description: "A playful trip through space — swipe, tap, explore.",
};

/**
 * Universe — mobile-first portrait stage.
 * Desktop just letterboxes a tall phone column. No PC scroll physics.
 */
export default function UniversePage() {
  return <UniverseShell />;
}
