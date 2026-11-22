export const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxBytes = 5 * 1024 * 1024;
export async function preparePhoto(file: File): Promise<File> {
  if (!allowedTypes.includes(file.type))
    throw new Error("Choose a JPEG, PNG, or WebP photo.");
  if (!file.size || file.size > maxBytes)
    throw new Error("Choose a nonempty photo of 5 MB or less.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(
      1,
      1280 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare that photo.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Could not resize this photo.")),
        "image/jpeg",
        0.84,
      ),
    );
    if (blob.size > maxBytes) throw new Error("Please choose a smaller photo.");
    return new File([blob], "report.jpg", { type: blob.type });
  } finally {
    URL.revokeObjectURL(url);
  }
}
