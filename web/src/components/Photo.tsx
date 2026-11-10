"use client";

import { useEffect, useState } from "react";
import { getPhoto } from "@/lib/store/db";

// Object URLs for photos saved on this device, shared by every place a photo is shown.
const urls = new Map<string, Promise<string | null>>();

function urlFor(id: string, size: "thumb" | "full"): Promise<string | null> {
  const key = `${size}:${id}`;
  let url = urls.get(key);
  if (!url) {
    url = getPhoto(id)
      .then((p) => (p ? URL.createObjectURL(size === "thumb" ? p.thumb : p.full) : null))
      .catch(() => null);
    urls.set(key, url);
  }
  return url;
}

/** Frees every object URL, after "Start over" or a new set of photos. */
export function forgetPhotoUrls(): void {
  for (const url of urls.values()) void url.then((u) => u && URL.revokeObjectURL(u));
  urls.clear();
}

export function Photo({
  id,
  size = "thumb",
  alt = "",
  className,
}: {
  id: string;
  size?: "thumb" | "full";
  alt?: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void urlFor(id, size).then((u) => {
      if (live) setSrc(u);
    });
    return () => {
      live = false;
    };
  }, [id, size]);
  if (!src) return <span className={`photo-missing ${className ?? ""}`} aria-hidden />;
  // Local object URLs: next/image can't optimise these.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
}
