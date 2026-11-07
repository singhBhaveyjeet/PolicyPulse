// Saves each agent's workspace in this browser (IndexedDB) so data survives refreshes and restarts.
// The data never leaves the device.
import type { Workspace } from "./types";
import { mergeProfile, mergeSettings } from "./settings";

const DB_NAME = "policypulse";
const STORE = "workspaces";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB is not available")); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: "email" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadWorkspace(email: string): Promise<Workspace> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(email);
    req.onsuccess = () => {
      const v = req.result as ({ email: string } & Partial<Workspace>) | undefined;
      resolve({ policies: v?.policies ?? [], imports: v?.imports ?? [], profile: mergeProfile(v?.profile), settings: mergeSettings(v?.settings) });
      db.close();
    };
    req.onerror = () => { reject(req.error); db.close(); };
  });
}

export async function saveWorkspace(email: string, ws: Workspace): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ email, ...ws, savedAt: new Date().toISOString() });
    tx.oncomplete = () => { resolve(); db.close(); };
    tx.onerror = () => { reject(tx.error); db.close(); };
    tx.onabort = () => { reject(tx.error); db.close(); };
  });
}
