import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gallery full-size photos (not thumbs).
 * Reads public/photos/*.{webp,jpg,…}, writes public/photos/ready/*.webp
 * Target: ~150–200KB each without crushing quality.
 */
const SOURCE_DIR = path.join(process.cwd(), "public", "photos");
const OUTPUT_DIR = path.join(SOURCE_DIR, "ready");

/** Nested folders we never treat as sources. */
const SKIP_DIRS = new Set(["thumbs", "ready", "originals"]);

const IMAGE_EXT = new Set([
  ".webp",
  ".jpg",
  ".jpeg",
  ".png",
  ".tif",
  ".tiff",
  ".avif",
]);

const TARGET_MIN = 150 * 1024;
const TARGET_MAX = 200 * 1024;
/** Soft overshoot when MIN_EDGE + MIN_QUALITY still won't fit the band. */
const HARD_MAX = 240 * 1024;
/**
 * App uploads at most 1280 (mobile) / 2048 (desktop) to the GPU.
 * Never shrink below mobile floor — quality first, then size band.
 */
const START_MAX_EDGE = 1600;
const MIN_EDGE = 1280;
const START_QUALITY = 86;
const MIN_QUALITY = 62;
const MAX_QUALITY_BUMP = 90;

type ItemResult = {
  source: string;
  output?: string;
  ok: boolean;
  error?: string;
  bytes?: number;
  kb?: number;
  sourceKb?: number;
  width?: number;
  height?: number;
  quality?: number;
  maxEdge?: number;
};

function isSourceFile(name: string): boolean {
  const lower = name.toLowerCase();
  const ext = path.extname(lower);
  if (!IMAGE_EXT.has(ext)) return false;
  if (name.startsWith(".")) return false;
  return true;
}

async function listSourceImages(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && isSourceFile(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Encode to WebP in the 150–200KB band.
 * Strategy (quality-first):
 *  1. Resize max edge to START_MAX_EDGE (never enlarge)
 *  2. If too big → drop quality step-by-step
 *  3. If quality floors → shrink edge, restore some quality
 *  4. If already under min (simple/small source) → accept (don't upsize)
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

  for (let attempt = 0; attempt < 28; attempt++) {
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

      // In band, or close with still-high quality
      if (bytes >= TARGET_MIN || quality >= START_QUALITY - 4) {
        return { buffer, ...bestMeta };
      }

      // Under 150KB: try a little more quality (won't invent detail, just less quantizing)
      if (quality < MAX_QUALITY_BUMP) {
        quality = Math.min(MAX_QUALITY_BUMP, quality + 3);
        continue;
      }
      return { buffer, ...bestMeta };
    }

    // Too big: prefer quality reduction over resolution loss
    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 5);
    } else if (maxEdge > MIN_EDGE) {
      maxEdge = Math.max(MIN_EDGE, Math.round(maxEdge * 0.92));
      quality = Math.min(START_QUALITY, quality + 6);
    } else if (quality > 48) {
      // Still over band at mobile edge floor — shave quality a bit more,
      // never go below 1280 (app's mobile texture size).
      quality = Math.max(48, quality - 4);
    } else {
      if (bytes <= HARD_MAX || !bestUnder) {
        return {
          buffer,
          width: meta.width ?? 0,
          height: meta.height ?? 0,
          quality,
          maxEdge,
        };
      }
      return { buffer: bestUnder, ...bestMeta };
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

async function processOne(filename: string): Promise<ItemResult> {
  const sourcePath = path.join(SOURCE_DIR, filename);
  const base = path.parse(filename).name;
  const outName = `${base}.webp`;
  const outputPath = path.join(OUTPUT_DIR, outName);

  try {
    const srcStat = await fs.stat(sourcePath);
    const encoded = await encodeToTarget(sourcePath);
    await fs.writeFile(outputPath, encoded.buffer);

    return {
      source: filename,
      output: `/photos/ready/${outName}`,
      ok: true,
      bytes: encoded.buffer.length,
      kb: Math.round((encoded.buffer.length / 1024) * 10) / 10,
      sourceKb: Math.round((srcStat.size / 1024) * 10) / 10,
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
 * POST /api/resize-photos
 * Reads public/photos/* (not thumbs/ready), writes public/photos/ready/*.webp
 * Target: ~150–200KB WebP each.
 *
 * Body (optional JSON):
 *   { "apply": true } — also copy ready → photos (overwrites full-size files; keeps thumbs)
 */
export async function POST(request: Request) {
  try {
    let apply = false;
    try {
      const body = (await request.json()) as { apply?: boolean };
      apply = Boolean(body?.apply);
    } catch {
      /* no body */
    }

    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Clear previous ready outputs
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
    for (const file of files) {
      items.push(await processOne(file));
    }

    if (apply) {
      // Backup originals once, then replace full-size photos with ready outputs
      const originalsDir = path.join(SOURCE_DIR, "originals");
      await fs.mkdir(originalsDir, { recursive: true });

      for (const item of items) {
        if (!item.ok || !item.output) continue;
        const base = path.parse(item.source).name;
        const readyPath = path.join(OUTPUT_DIR, `${base}.webp`);
        const destPath = path.join(SOURCE_DIR, `${base}.webp`);
        const backupPath = path.join(originalsDir, item.source);

        try {
          await fs.access(backupPath);
        } catch {
          // Only backup if we don't already have an originals copy
          await fs.copyFile(destPath, backupPath).catch(() => undefined);
        }

        // Windows-friendly replace (copyFile over existing can fail with UNKNOWN)
        const buf = await fs.readFile(readyPath);
        const tmp = `${destPath}.tmp`;
        await fs.writeFile(tmp, buf);
        await fs.unlink(destPath).catch(() => undefined);
        await fs.rename(tmp, destPath);
        item.output = `/photos/${base}.webp`;
      }
    }

    const succeeded = items.filter((i) => i.ok).length;
    const failed = items.filter((i) => !i.ok).length;

    return NextResponse.json({
      ok: failed === 0,
      processed: items.length,
      succeeded,
      failed,
      applied: apply,
      sourceDir: "/public/photos",
      outputDir: apply ? "/photos" : "/photos/ready",
      targetKb: "150–200",
      skipDirs: [...SKIP_DIRS],
      items,
      message:
        failed === 0
          ? apply
            ? `Optimized ${succeeded} photo(s) to ~150–200KB and applied in place (originals backed up).`
            : `Optimized ${succeeded} photo(s) to WebP (~150–200KB) in /photos/ready. POST { "apply": true } to replace.`
          : `Optimized ${succeeded}; ${failed} failed.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[resize-photos]", err);
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
    endpoint: "POST /api/resize-photos",
    source: "/public/photos",
    output: "/public/photos/ready",
    targetKb: "150–200",
    format: "webp",
    apply: 'POST body { "apply": true } also replaces /photos/*.webp (backs up to /photos/originals)',
  });
}
