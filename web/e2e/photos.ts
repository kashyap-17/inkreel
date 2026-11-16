// Sample photos for the browser tests, drawn in the page so no real photos are ever stored in
// the repo. Each "good" photo is a different pattern of hard-edged blocks (sharp, and different
// enough not to be stacked together).
import type { Page } from "@playwright/test";

export interface SamplePhoto {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

type Kind = "good" | "blurry" | "black" | "screenshot";

async function draw(page: Page, kind: Kind, seed: number): Promise<SamplePhoto> {
  const png = kind === "screenshot";
  const base64 = await page.evaluate(
    ({ kind, seed, png }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 1000;
      const ctx = canvas.getContext("2d")!;
      // A small repeatable random number generator, so each seed always gives the same picture.
      let x = seed * 9973 + 17;
      const next = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
      if (kind === "black") {
        ctx.fillStyle = "rgb(3,3,3)";
        ctx.fillRect(0, 0, 800, 1000);
      } else if (kind === "blurry") {
        const g = ctx.createLinearGradient(0, 0, 800, 1000);
        g.addColorStop(0, "rgb(90,110,140)");
        g.addColorStop(1, "rgb(150,130,110)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 800, 1000);
      } else {
        for (let row = 0; row < 10; row++) {
          for (let col = 0; col < 8; col++) {
            ctx.fillStyle = `rgb(${Math.floor(next() * 256)},${Math.floor(next() * 256)},${Math.floor(next() * 256)})`;
            ctx.fillRect(col * 100, row * 100, 100, 100);
          }
        }
      }
      return canvas.toDataURL(png ? "image/png" : "image/jpeg", 0.9).split(",")[1]!;
    },
    { kind, seed, png },
  );
  const name =
    kind === "screenshot" ? `Screenshot_${seed}.png` : `${kind === "good" ? "photo" : kind}-${String(seed).padStart(2, "0")}.jpg`;
  return { name, mimeType: png ? "image/png" : "image/jpeg", buffer: Buffer.from(base64, "base64") };
}

/** `count` different sharp photos. */
export const goodPhotos = (page: Page, count: number, from = 1) =>
  Promise.all(Array.from({ length: count }, (_, i) => draw(page, "good", from + i)));

/** A blurry photo, a black frame and a screenshot: one of each kind that should be set aside. */
export const weakPhotos = (page: Page) =>
  Promise.all([draw(page, "blurry", 91), draw(page, "black", 92), draw(page, "screenshot", 93)]);
