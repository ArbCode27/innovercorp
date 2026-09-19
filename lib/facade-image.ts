export const MAX_FACADE_IMAGE_BYTES = 5 * 1024 * 1024;
export const FACADE_IMAGE_ACCEPT = "image/jpeg,image/jpg,image/png,image/webp";

const ALLOWED_FACADE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export class FacadeImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FacadeImageError";
  }
}

export const isAllowedFacadeMime = (mime: string) =>
  ALLOWED_FACADE_MIMES.has(mime.trim().toLowerCase());

export const facadeImageExtension = (mime: string) => {
  const normalized = mime.trim().toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  return "jpg";
};

export const assertFacadeImageFile = (file: File) => {
  if (!file || file.size <= 0) {
    throw new FacadeImageError("La imagen no es válida");
  }
  if (file.size > MAX_FACADE_IMAGE_BYTES) {
    throw new FacadeImageError("La imagen no puede superar 5 MB");
  }
  if (!isAllowedFacadeMime(file.type)) {
    throw new FacadeImageError("Usa JPG, PNG o WebP");
  }
  return file;
};

export const pickImageFromDataTransfer = (data: DataTransfer | null) => {
  if (!data) return null;

  const fromFiles = Array.from(data.files || []).find((file) =>
    file.type.toLowerCase().startsWith("image/"),
  );
  if (fromFiles) return fromFiles;

  for (const item of Array.from(data.items || [])) {
    if (item.kind !== "file" || !item.type.toLowerCase().startsWith("image/")) {
      continue;
    }
    const file = item.getAsFile();
    if (file) return file;
  }

  return null;
};
