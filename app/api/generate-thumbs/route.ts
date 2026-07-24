import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Actual portfolio folder (project uses `photos`, not `phots`). */
const PHOTOS_DIR = path.join(process.cwd(), "public", "photos");
const THUMBS_DIR = path.join(PHOTOS_DIR, "thumbs");

const IMAGE_EXT = new Set([
  ".webp",
  ".jpg",
  ".jpeg",
  ".png",
  ".tif",
  ".tiff",
  ".avif",
]);

const MAX_WIDTH = 600;
const WEBP_QUALITY = 82;

type ItemResult = {
  source: string;
  output?: string;
  ok: boolean;
  error?: string;
  width?: number;
  height?: number;
};

async function listSourceImages(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read photos folder (${dir}): ${message}`);
  }

  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
    // skip anything already in a nested path name; we only read the root
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

async function processOne(filename: string): Promise<ItemResult> {
  const source = path.join(PHOTOS_DIR, filename);
  const base = path.parse(filename).name;
  const outName = `${base}.webp`;
  const output = path.join(THUMBS_DIR, outName);

  try {
    const image = sharp(source);
    const meta = await image.metadata();

    const pipeline = sharp(source).rotate().resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,
      fit: "inside",
    });

    await pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toFile(output);

    const outMeta = await sharp(output).metadata();

    return {
      source: filename,
      output: path.posix.join("/photos/thumbs", outName),
      ok: true,
      width: outMeta.width ?? meta.width,
      height: outMeta.height ?? meta.height,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      source: filename,
      ok: false,
      error: message,
    };
  }
}

/**
 * POST /api/generate-thumbs
 * Reads public/photos/*, writes public/photos/thumbs/*.webp (max width 600).
 */
export async function POST() {
  try {
    await fs.mkdir(THUMBS_DIR, { recursive: true });

    const files = await listSourceImages(PHOTOS_DIR);

    if (files.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        succeeded: 0,
        failed: 0,
        message: `No images found in ${PHOTOS_DIR}`,
        items: [],
      });
    }

    const items: ItemResult[] = [];
    for (const file of files) {
      items.push(await processOne(file));
    }

    const succeeded = items.filter((i) => i.ok).length;
    const failed = items.filter((i) => !i.ok).length;

    return NextResponse.json({
      ok: failed === 0,
      processed: items.length,
      succeeded,
      failed,
      thumbsDir: "/photos/thumbs",
      maxWidth: MAX_WIDTH,
      format: "webp",
      quality: WEBP_QUALITY,
      items,
      message:
        failed === 0
          ? `Generated ${succeeded} thumbnail(s).`
          : `Generated ${succeeded} thumbnail(s); ${failed} failed.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate-thumbs]", err);
    return NextResponse.json(
      {
        ok: false,
        processed: 0,
        succeeded: 0,
        failed: 0,
        message,
        items: [],
      },
      { status: 500 },
    );
  }
}

/** GET for a quick health check / description. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/generate-thumbs",
    source: "/public/photos",
    output: "/public/photos/thumbs",
    maxWidth: MAX_WIDTH,
    format: "webp",
  });
}
