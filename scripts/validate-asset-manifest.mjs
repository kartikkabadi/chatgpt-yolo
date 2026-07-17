import { readFileSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function parsePngDimensions(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIG)) return null;
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

export function parseWebpDimensions(buffer) {
  if (buffer.length < 30) return null;
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8 ") {
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const width = view.getUint16(26, true) & 0x3fff;
      const height = view.getUint16(28, true) & 0x3fff;
      return { width, height };
    }
    if (chunk === "VP8L") {
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const bits = view.getUint32(21, true);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { width, height };
    }
    if (chunk === "VP8X") {
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const width = 1 + (view.getUint32(24, false) & 0xffffff);
      const height = 1 + (view.getUint32(27, false) & 0xffffff);
      return { width, height };
    }
  }
  return null;
}

export function parseSvgDimensions(text) {
  const widthMatch = text.match(/width=["']([0-9.]+)(?:px)?["']/i);
  const heightMatch = text.match(/height=["']([0-9.]+)(?:px)?["']/i);
  const viewBoxMatch = text.match(/viewBox=["']\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*["']/i);
  if (widthMatch && heightMatch) {
    return { width: Number(widthMatch[1]), height: Number(heightMatch[1]) };
  }
  if (viewBoxMatch) {
    return { width: Number(viewBoxMatch[3]), height: Number(viewBoxMatch[4]) };
  }
  return null;
}

export function parseImageDimensions(file) {
  const buffer = readFileSync(file);
  if (file.endsWith(".png")) return parsePngDimensions(buffer);
  if (file.endsWith(".webp")) return parseWebpDimensions(buffer);
  if (file.endsWith(".svg")) return parseSvgDimensions(buffer.toString("utf-8"));
  return null;
}

export function parseDimensions(declared) {
  const match = String(declared).match(/(\d+)\s*x\s*(\d+)/);
  if (match) return { width: Number(match[1]), height: Number(match[2]) };
  return null;
}

export function parseFrameRate(fpsString) {
  if (typeof fpsString === "number") return fpsString;
  const [num, den] = String(fpsString).split("/").map(Number);
  if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) return num / den;
  return Number(fpsString);
}

export function ffprobe(file) {
  try {
    const out = execFileSync("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_streams",
      "-show_format",
      file,
    ], { encoding: "utf-8" });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

export function validateEntry(item, file, seen) {
  const errors = [];

  if (!item.path) errors.push("missing path");
  if (!item.sha256) errors.push("missing sha256");
  if (item.path) {
    if (item.path.includes("..") || path.isAbsolute(item.path)) {
      errors.push("unsafe path");
    }
    if (seen.has(item.path)) errors.push("duplicate path");
    seen.add(item.path);
  }

  if (!existsSync(file)) {
    errors.push("file missing");
    return errors;
  }

  const stat = statSync(file);
  const actualKb = Math.round(stat.size / 1024);
  const actualMb = +(stat.size / 1024 / 1024).toFixed(1);

  if (item.size_budget_kb && stat.size > item.size_budget_kb * 1024) {
    errors.push(`size ${actualKb} KB exceeds budget ${item.size_budget_kb} KB`);
  }
  if (item.size_budget_mb && stat.size > item.size_budget_mb * 1024 * 1024) {
    errors.push(`size ${actualMb} MB exceeds budget ${item.size_budget_mb} MB`);
  }

  if (item.sha256) {
    const actual = sha256(file);
    if (actual !== item.sha256) {
      errors.push(`sha256 mismatch: expected ${item.sha256}, got ${actual}`);
    }
  }

  const dims = parseImageDimensions(file);
  if (dims && item.dimensions) {
    const declared = parseDimensions(item.dimensions);
    if (declared && (Math.abs(dims.width - declared.width) > 1 || Math.abs(dims.height - declared.height) > 1)) {
      errors.push(`dimensions mismatch: declared ${item.dimensions}, actual ${dims.width}x${dims.height}`);
    }
  }

  if (item.format === "mp4") {
    const meta = ffprobe(file);
    if (!meta) {
      errors.push("ffprobe failed");
    } else {
      const video = meta.streams.find((s) => s.codec_type === "video");
      if (!video) {
        errors.push("no video stream");
      } else {
        if (item.codec && !video.codec_name?.toLowerCase().startsWith(item.codec.toLowerCase())) {
          errors.push(`codec mismatch: ${video.codec_name}`);
        }
        if (item.pix_fmt && video.pix_fmt !== item.pix_fmt) {
          errors.push(`pix_fmt mismatch: ${video.pix_fmt}`);
        }
        if (item.fps && Math.abs(parseFrameRate(video.r_frame_rate) - item.fps) > 0.1) {
          errors.push(`fps mismatch: ${video.r_frame_rate}`);
        }
        if (item.dimensions) {
          const declared = parseDimensions(item.dimensions);
          if (declared && (Math.abs(video.width - declared.width) > 1 || Math.abs(video.height - declared.height) > 1)) {
            errors.push(`video dimensions mismatch: ${video.width}x${video.height}`);
          }
        }
        if (item.audio === false && meta.streams.some((s) => s.codec_type === "audio")) {
          errors.push("unexpected audio stream");
        }
      }
      if (item.duration_s && meta.format?.duration) {
        if (Math.abs(Number(meta.format.duration) - Number(item.duration_s)) > 0.5) {
          errors.push(`duration mismatch: ${meta.format.duration}s`);
        }
      }
    }
  }

  return errors;
}

function main() {
  const manifestPath = path.join(root, "marketing", "asset-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const all = [...(manifest.images || []), ...(manifest.videos || [])];
  const seen = new Set();
  let failed = false;

  for (const item of all) {
    const file = path.join(root, item.path);
    const errors = validateEntry(item, file, seen);
    if (errors.length) {
      failed = true;
      for (const e of errors) {
        console.error(`ERROR: ${item.path}: ${e}`);
      }
    } else {
      console.log(`OK: ${item.path}`);
    }
  }

  if (failed) {
    console.error("Asset manifest validation failed.");
    process.exit(1);
  }
  console.log("Asset manifest validated.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
