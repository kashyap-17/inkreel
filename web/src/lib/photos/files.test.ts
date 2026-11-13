import { describe, expect, it } from "vitest";
import { sniffFormat } from "./files";

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
