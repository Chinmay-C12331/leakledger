import sharp from "sharp";
import { HttpError } from "./http.ts";
export const maxPhotoBytes = 5 * 1024 * 1024;
const formatFor = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export async function cleanPhoto(file: File) {
  if (file.size > maxPhotoBytes)
    throw new HttpError(413, "Photo must be 5 MB or smaller.");
  const format = formatFor[file.type as keyof typeof formatFor];
  if (!format || !file.size)
    throw new HttpError(415, "Use a JPEG, PNG, or WebP photo.");
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const image = sharp(bytes, {
      limitInputPixels: 1280 * 1280,
      failOn: "warning",
    });
    const meta = await image.metadata();
    if (
      meta.format !== format ||
      !meta.width ||
      !meta.height ||
      meta.width > 1280 ||
      meta.height > 1280 ||
      (meta.pages ?? 1) > 1
    )
      throw new Error();
    // Fully decode and re-encode to discard timestamps, GPS EXIF and trailing bytes.
    return {
      bytes: await image.rotate().webp({ quality: 85 }).toBuffer(),
      mime: "image/webp",
    };
  } catch {
    throw new HttpError(
      400,
      "Photo must be a valid, single-frame image up to 1280 pixels on its longest side.",
    );
  }
}
