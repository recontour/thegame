import type { Metadata } from "next";
import { Inter, Open_Sans, Roboto } from "next/font/google";
import UniverseShell from "@/components/universe/UniverseShell";
import "./universe.css";

/** Heading face — applied via `.u-h1` */
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-u-h1",
  display: "swap",
});

/** Body face — applied via `.u-p1` */
const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-u-p1",
  display: "swap",
});

/** Button labels — applied via `.ctrl-btn` */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-u-btn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Universe",
  description: "A playful trip through space — swipe, tap, explore.",
};

/**
 * Universe — mobile-first portrait stage.
 * Desktop just letterboxes a tall phone column. No PC scroll physics.
 *
 * Fonts load once here; classify copy with `.u-h1` / `.u-p1` section by section.
 * All `.ctrl-btn` labels use Inter.
 */
export default function UniversePage() {
  return (
    <div
      className={`universe-fonts ${roboto.variable} ${openSans.variable} ${inter.variable}`}
    >
      <UniverseShell />
    </div>
  );
}
