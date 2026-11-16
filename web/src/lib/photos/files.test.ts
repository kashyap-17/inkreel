import { describe, expect, it } from "vitest";
import { copyFiles, sniffFormat } from "./files";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

describe("sniffFormat", () => {
  it("recognises JPEG and PNG", () => {
    expect(sniffFormat(bytes([0xff, 0xd8, 0xff, 0xe1]))).toBe("jpeg");
    expect(sniffFormat(bytes([0x89], "PNG"))).toBe("png");
  });

  it("recognises HEIC and HEIF brands, and AVIF separately", () => {
    expect(sniffFormat(bytes([0, 0, 0, 0x18], "ftypheic"))).toBe("heic");
    expect(sniffFormat(bytes([0, 0, 0, 0x18], "ftypmif1"))).toBe("heic");
    expect(sniffFormat(bytes([0, 0, 0, 0x18], "ftypavif"))).toBe("avif");
  });

  it("says unknown for anything else", () => {
    expect(sniffFormat(bytes("hello world!"))).toBe("unknown");
    expect(sniffFormat(new Uint8Array())).toBe("unknown");
  });
});

describe("copyFiles", () => {
  const photo = (name: string, text: string) =>
    new File([text], name, { type: "image/jpeg", lastModified: 1_700_000_000_000 });
  /** A picked file the phone has stopped handing over. */
  const withdrawn = (name: string) => {
    const file = photo(name, "gone");
    file.arrayBuffer = () => Promise.reject(new DOMException("The requested file could not be read", "NotReadableError"));
    return file;
  };

  it("copies each file with its name, type and date, in order", async () => {
    const files = [photo("a.jpg", "aaa"), photo("b.jpg", "bb"), photo("c.jpg", "c")];
    const out = await copyFiles(files, 2);
    expect(out.map((c) => c.copied)).toEqual([true, true, true]);
    expect(out.map((c) => c.file.name)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    expect(out.every((c, i) => c.file !== files[i])).toBe(true);
    expect(await out[0]!.file.text()).toBe("aaa");
    expect(out[1]!.file.type).toBe("image/jpeg");
    expect(out[2]!.file.lastModified).toBe(1_700_000_000_000);
  });

  it("keeps going past files that can't be read, and hands those back as they were", async () => {
    const lost = withdrawn("b.jpg");
    const out = await copyFiles([photo("a.jpg", "a"), lost, photo("c.jpg", "c")]);
    expect(out.map((c) => c.copied)).toEqual([true, false, true]);
    expect(out[1]!.file).toBe(lost);
    expect(out[1]!.error).toMatch(/^NotReadableError/);
    expect(await out[2]!.file.text()).toBe("c");
  });
});
