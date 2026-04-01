/// <reference lib="WebWorker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Workbox injects the precache manifest here at build time.
precacheAndRoute(self.__WB_MANIFEST);

// ── Notification click → bring app to foreground ─────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if ("focus" in c) return (c as WindowClient).focus();
        }
        return self.clients.openWindow(url);
      })
  );
});

// ── Periodic Background Sync ─────────────────────────────────────────────────
// Fires on Android Chrome when the PWA is installed and the app is closed.
// iOS does NOT support this — Apple requires a push server for background delivery.
self.addEventListener("periodicsync", (event: any) => {
  if (event.tag === "smarttrack-reminders") {
    event.waitUntil(checkAndFireScheduledNotifications());
  }
});

async function checkAndFireScheduledNotifications(): Promise<void> {
  try {
    const db = await openSmartTrackDB();
    const notifications = await getAllFromStore<{
      id: string;
      title: string;
      message: string;
      time: string;
      frequency: string;
      isActive: boolean;
    }>(db, "notifications");

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const today = now.getDay();       // 0 = Sunday
    const dayOfMonth = now.getDate();

    for (const notif of notifications) {
      if (!notif.isActive) continue;
      if (notif.time !== currentTime) continue;

      let shouldFire = false;
      if (notif.frequency === "daily") shouldFire = true;
      else if (notif.frequency === "weekly" && today === 1) shouldFire = true;
      else if (notif.frequency === "monthly" && dayOfMonth === 1) shouldFire = true;

      if (shouldFire) {
        await self.registration.showNotification(`SmartTrack · ${notif.title}`, {
          body: notif.message,
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-72.png",
          tag: `smarttrack-${notif.id}`,
          data: { url: "/" },
        });
      }
    }
  } catch (err) {
    console.warn("[SW] Notification check failed:", err);
  }
}

// ── Minimal IndexedDB helpers (Dexie cannot run inside a SW) ─────────────────

function openSmartTrackDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("SmartTrackDB", 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
    // If the SW opens the DB before Dexie has run, the schema won't exist yet.
    // In that case just resolve with an empty-store-safe DB.
    req.onupgradeneeded = () => {/* Dexie owns the schema; SW only reads */};
  });
}

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    try {
      const tx  = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror   = () => reject(req.error);
    } catch (err) {
      // Store may not exist if DB version mismatch; return empty safely.
      resolve([]);
    }
  });
}
