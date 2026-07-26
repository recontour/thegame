/**
 * One-shot optimizer for public/photos → ~150–200KB WebP.
 * Mirrors POST /api/resize-photos (quality-first encode).
 *
 * Usage:
 *   node scripts/optimize-photos.mjs           # write to ready/ only
 *   node scripts/optimize-photos.mjs --apply   # also replace public/photos/*.webp
 */
import { promises as fs } from "fs";
import path from "path";
import sharp from "sharp";

const SOURCE_DIR = path.join(process.cwd(), "public", "photos");
const OUTPUT_DIR = path.join(SOURCE_DIR, "ready");
const ORIGINALS_DIR = path.join(SOURCE_DIR, "originals");

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
 * App GPU upload: 1280 mobile / 2048 desktop — never go below mobile floor.
 * 1600 start keeps gallery sharp without oversized files.
 */
const START_MAX_EDGE = 1600;
const MIN_EDGE = 1280;
const START_QUALITY = 86;
const MIN_QUALITY = 62;
const MAX_QUALITY_BUMP = 90;

const APPLY = process.argv.includes("--apply");

async function encodeToTarget(sourcePath) {
  let maxEdge = START_MAX_EDGE;
  let quality = START_QUALITY;
  let bestUnder = null;
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
      if (bytes >= TARGET_MIN || quality >= START_QUALITY - 4) {
        return { buffer, ...bestMeta };
      }
      if (quality < MAX_QUALITY_BUMP) {
        quality = Math.min(MAX_QUALITY_BUMP, quality + 3);
        continue;
      }
      return { buffer, ...bestMeta };
    }

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
      // Absolute floor: keep resolution; prefer ≤ HARD_MAX over tiny edge
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

  if (bestUnder) return { buffer: bestUnder, ...bestMeta };

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

/** Prefer true originals when present so re-runs never double-compress. */
async function resolveSource(filename) {
  const fromOriginals = path.join(ORIGINALS_DIR, filename);
  try {
    await fs.access(fromOriginals);
    return fromOriginals;
  } catch {
    return path.join(SOURCE_DIR, filename);
  }
}

async function writeReplace(destPath, buffer) {
  // Windows-friendly replace: write temp then rename
  const tmp = `${destPath}.tmp-${process.pid}`;
  await fs.writeFile(tmp, buffer);
  try {
    await fs.unlink(destPath);
  } catch {
    /* may not exist */
  }
  await fs.rename(tmp, destPath);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  if (APPLY) await fs.mkdir(ORIGINALS_DIR, { recursive: true });

  const files = (await fs.readdir(SOURCE_DIR, { withFileTypes: true }))
    .filter(
      (e) => e.isFile() && IMAGE_EXT.has(path.extname(e.name).toLowerCase()),
    )
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  console.log(
    `Processing ${files.length} image(s) → ready/${APPLY ? " + apply in place" : ""}`,
  );

  const results = [];

  for (const file of files) {
    const sourcePath = await resolveSource(file);
    const srcStat = await fs.stat(sourcePath);
    const base = path.parse(file).name;
    const outName = `${base}.webp`;
    const encoded = await encodeToTarget(sourcePath);

    const readyPath = path.join(OUTPUT_DIR, outName);
    await fs.writeFile(readyPath, encoded.buffer);

    if (APPLY) {
      const destPath = path.join(SOURCE_DIR, `${base}.webp`);
      const backupPath = path.join(ORIGINALS_DIR, file);
      try {
        await fs.access(backupPath);
      } catch {
        // Backup current file only if no original yet (and source isn't already from originals)
        const live = path.join(SOURCE_DIR, file);
        try {
          await fs.copyFile(live, backupPath);
        } catch {
          await fs.writeFile(backupPath, await fs.readFile(sourcePath));
        }
      }
      await writeReplace(destPath, encoded.buffer);
    }

    const row = {
      file,
      sourceKb: +(srcStat.size / 1024).toFixed(1),
      outKb: +(encoded.buffer.length / 1024).toFixed(1),
      size: `${encoded.width}x${encoded.height}`,
      q: encoded.quality,
      edge: encoded.maxEdge,
    };
    results.push(row);
    console.log(
      row.file.padEnd(10),
      `${String(row.sourceKb).padStart(8)}KB →`,
      `${String(row.outKb).padStart(6)}KB`,
      row.size.padStart(12),
      `q=${row.q}`,
      `edge=${row.edge}`,
    );
  }

  const totalIn = results.reduce((s, r) => s + r.sourceKb, 0);
  const totalOut = results.reduce((s, r) => s + r.outKb, 0);
  console.log("---");
  console.log(
    `Total ${totalIn.toFixed(0)}KB → ${totalOut.toFixed(0)}KB (${((1 - totalOut / totalIn) * 100).toFixed(0)}% smaller)`,
  );
  console.log(
    `Band hits (150–200): ${results.filter((r) => r.outKb >= 150 && r.outKb <= 200).length}/${results.length}`,
  );
  const under = results.filter((r) => r.outKb < 150);
  const over = results.filter((r) => r.outKb > 200);
  if (under.length) {
    console.log(
      "Under 150 (ok for simple sources):",
      under.map((r) => `${r.file}:${r.outKb}`).join(", "),
    );
  }
  if (over.length) {
    console.log(
      "Over 200:",
      over.map((r) => `${r.file}:${r.outKb}`).join(", "),
    );
  }
  if (APPLY) {
    console.log("Applied in place. Originals backed up to public/photos/originals/");
  } else {
    console.log('Dry ready only. Re-run with --apply to replace public/photos/*.webp');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
