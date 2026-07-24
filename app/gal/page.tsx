import Scene from "@/components/Scene";

/**
 * Current collage gallery flow (hero WebGL → DOM collage).
 * Isolated route so / and /work stay free of this bundle/GPU path.
 */
export default function GalPage() {
  return <Scene />;
}
