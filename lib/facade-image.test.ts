import { describe, expect, it } from "vitest";
import {
  assertFacadeImageFile,
  FacadeImageError,
  facadeImageExtension,
  isAllowedFacadeMime,
  pickImageFromDataTransfer,
} from "./facade-image";

const imageFile = (name: string, type: string, size = 12) =>
  new File([new Uint8Array(size)], name, { type });

describe("isAllowedFacadeMime", () => {
  it("accepts jpeg, png and webp", () => {
    expect(isAllowedFacadeMime("image/jpeg")).toBe(true);
    expect(isAllowedFacadeMime("image/png")).toBe(true);
    expect(isAllowedFacadeMime("image/webp")).toBe(true);
  });

  it("rejects other types", () => {
    expect(isAllowedFacadeMime("image/gif")).toBe(false);
    expect(isAllowedFacadeMime("application/pdf")).toBe(false);
  });
});

describe("assertFacadeImageFile", () => {
  it("keeps a valid image", () => {
    const file = imageFile("fachada.jpg", "image/jpeg");
    expect(assertFacadeImageFile(file)).toBe(file);
    expect(facadeImageExtension(file.type)).toBe("jpg");
  });

  it("rejects empty or oversized files", () => {
    expect(() => assertFacadeImageFile(imageFile("empty.png", "image/png", 0))).toThrow(
      FacadeImageError,
    );
    expect(() =>
      assertFacadeImageFile(imageFile("huge.png", "image/png", 6 * 1024 * 1024)),
    ).toThrow(/5 MB/);
  });
});

describe("pickImageFromDataTransfer", () => {
  it("prefers files over items", () => {
    const file = imageFile("casa.png", "image/png");
    const data = {
      files: [file] as unknown as FileList,
      items: [],
    } as unknown as DataTransfer;
    expect(pickImageFromDataTransfer(data)?.name).toBe("casa.png");
  });

  it("reads a clipboard item when files are empty", () => {
    const file = imageFile("screenshot.png", "image/png");
    const data = {
      files: [] as unknown as FileList,
      items: [
        {
          kind: "file",
          type: "image/png",
          getAsFile: () => file,
        },
      ],
    } as unknown as DataTransfer;
    expect(pickImageFromDataTransfer(data)).toBe(file);
  });

  it("returns null when there is no image", () => {
    expect(pickImageFromDataTransfer(null)).toBeNull();
  });
});
