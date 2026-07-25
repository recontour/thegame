import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_DIR = path.join(process.cwd(), "public", "landing");
const OUTPUT_DIR = path.join(SOURCE_DIR, "ready");

const IMAGE_EXT = new Set([
  ".webp",
  ".jpg",
  ".jpeg",
  ".png",
  ".tif",
  ".tiff",
  ".avif",
]);

/** Skip already-optimized outputs and junk. */
function isSourceFile(name: string): boolean {
  const lower = name.toLowerCase();
  const ext = path.extname(lower);
  if (!IMAGE_EXT.has(ext)) return false;
  if (name.startsWith(".")) return false;
  return true;
}

const TARGET_MIN = 80 * 1024;
const TARGET_MAX = 100 * 1024;
const START_MAX_EDGE = 1600;
const MIN_EDGE = 720;
const START_QUALITY = 82;
const MIN_QUALITY = 48;

type ItemResult = {
  source: string;
  output?: string;
  ok: boolean;
  error?: string;
  bytes?: number;
  kb?: number;
  width?: number;
  height?: number;
  quality?: number;
  maxEdge?: number;
};

async function listSourceImages(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && isSourceFile(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Encode to WebP, iteratively lowering quality then edge until within ~80–100KB.
 * Prefer staying under 100KB; if under 80KB after a pass, keep best under 100KB.
 */
async function encodeToTarget(
  sourcePath: string,
): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
  quality: number;
  maxEdge: number;
}> {
  let maxEdge = START_MAX_EDGE;
  let quality = START_QUALITY;
  let bestUnder: Buffer | null = null;
  let bestMeta = { width: 0, height: 0, quality, maxEdge };

  for (let attempt = 0; attempt < 24; attempt++) {
    const buffer = await sharp(sourcePath)
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 6 })
      .toBuffer();

    const meta = await sharp(buffer).metadata();
    const bytes = buffer.length;

    if (bytes <= TARGET_MAX) {
      bestUnder = buffer;
      bestMeta = {
        width: meta.width ?? 0,
        height: meta.height ?? 0,
        quality,
        maxEdge,
      };
      // Close enough to band — stop if also >= min or quality already high
      if (bytes >= TARGET_MIN || quality >= START_QUALITY - 4) {
        return { buffer, ...bestMeta };
      }
      // Too small: try a bit more quality once, else accept
      if (quality < 88) {
        quality = Math.min(90, quality + 4);
        continue;
      }
      return { buffer, ...bestMeta };
    }

    // Too big: drop quality first, then edge
    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 6);
    } else if (maxEdge > MIN_EDGE) {
      maxEdge = Math.max(MIN_EDGE, Math.round(maxEdge * 0.88));
      quality = Math.min(START_QUALITY, quality + 8);
    } else {
      // Floor — return smallest we can
      return {
        buffer: bestUnder ?? buffer,
        width: meta.width ?? 0,
        height: meta.height ?? 0,
        quality,
        maxEdge,
      };
    }
  }

  if (bestUnder) {
    return { buffer: bestUnder, ...bestMeta };
  }

  const fallback = await sharp(sourcePath)
    .rotate()
    .resize({ width: MIN_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: MIN_QUALITY, effort: 6 })
    .toBuffer();
  const meta = await sharp(fallback).metadata();
  return {
    buffer: fallback,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    quality: MIN_QUALITY,
    maxEdge: MIN_EDGE,
  };
}

async function processOne(
  filename: string,
  index: number,
): Promise<ItemResult> {
  const sourcePath = path.join(SOURCE_DIR, filename);
  const outName = `${index + 1}.webp`;
  const outputPath = path.join(OUTPUT_DIR, outName);

  try {
    const encoded = await encodeToTarget(sourcePath);
    await fs.writeFile(outputPath, encoded.buffer);

    return {
      source: filename,
      output: `/landing/ready/${outName}`,
      ok: true,
      bytes: encoded.buffer.length,
      kb: Math.round((encoded.buffer.length / 1024) * 10) / 10,
      width: encoded.width,
      height: encoded.height,
      quality: encoded.quality,
      maxEdge: encoded.maxEdge,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { source: filename, ok: false, error: message };
  }
}

/**
 * POST /api/resize-landing
 * Reads public/landing/* (not ready/), writes public/landing/ready/1.webp…
 * Target: ~80–100KB WebP each.
 */
export async function POST() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Clear previous ready outputs so renumbering stays clean
    const existing = await fs.readdir(OUTPUT_DIR).catch(() => [] as string[]);
    for (const name of existing) {
      if (name.toLowerCase().endsWith(".webp")) {
        await fs.unlink(path.join(OUTPUT_DIR, name)).catch(() => undefined);
      }
    }

    const files = await listSourceImages(SOURCE_DIR);

    if (files.length === 0) {
      return NextResponse.json({
        ok: true,
        processed: 0,
        succeeded: 0,
        failed: 0,
        message: `No source images in ${SOURCE_DIR}`,
        items: [],
      });
    }

    const items: ItemResult[] = [];
    for (let i = 0; i < files.length; i++) {
      items.push(await processOne(files[i], i));
    }

    const succeeded = items.filter((i) => i.ok).length;
    const failed = items.filter((i) => !i.ok).length;

    return NextResponse.json({
      ok: failed === 0,
      processed: items.length,
      succeeded,
      failed,
      sourceDir: "/public/landing",
      outputDir: "/landing/ready",
      targetKb: "80–100",
      items,
      message:
        failed === 0
          ? `Resized ${succeeded} landing image(s) to WebP (~80–100KB).`
          : `Resized ${succeeded}; ${failed} failed.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[resize-landing]", err);
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

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/resize-landing",
    source: "/public/landing",
    output: "/public/landing/ready",
    targetKb: "80–100",
    format: "webp",
  });
}
