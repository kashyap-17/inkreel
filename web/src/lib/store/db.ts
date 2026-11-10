// The trip draft, saved on this device in IndexedDB (docs/decisions.md, "Backend").
// Nothing here leaves the device. "Start over" deletes all of it.
import type { PhotoRecord } from "@/lib/photos/types";

const DB_NAME = "inkreel";
const VERSION = 1;
const KV = "kv";
const PHOTOS = "photos";
const VECTORS = "vectors";

export interface StoredPhoto {
  id: string;
  record: PhotoRecord;
  /** Working copy (long edge up to 2048 px, location and other details removed). */
  full: Blob;
  thumb: Blob;
}

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(VECTORS)) db.createObjectStore(VECTORS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const kvGet = <T>(key: string) => run<T | undefined>(KV, "readonly", (s) => s.get(key));
export const kvSet = (key: string, value: unknown) => run(KV, "readwrite", (s) => void s.put(value, key));

export const putPhoto = (photo: StoredPhoto) => run(PHOTOS, "readwrite", (s) => void s.put(photo));
export const getPhoto = (id: string) => run<StoredPhoto | undefined>(PHOTOS, "readonly", (s) => s.get(id));
export const deletePhotos = (ids: string[]) =>
  run(PHOTOS, "readwrite", (s) => {
    for (const id of ids) s.delete(id);
  });

export const putVector = (id: string, vector: number[]) =>
  run(VECTORS, "readwrite", (s) => void s.put(Float32Array.from(vector), id));
export async function getVectors(ids: string[]): Promise<Map<string, Float32Array>> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VECTORS, "readonly");
    const store = tx.objectStore(VECTORS);
    const found = new Map<string, Float32Array>();
    for (const id of ids) {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) found.set(id, req.result as Float32Array);
      };
    }
    tx.oncomplete = () => resolve(found);
    tx.onerror = () => reject(tx.error);
  });
}

/** Deletes the whole draft: writing, photos, saved searches and matches. */
export async function clearAll(): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([KV, PHOTOS, VECTORS], "readwrite");
    for (const name of [KV, PHOTOS, VECTORS]) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
