/// <reference lib="WebWorker" />
// VitePWA injects the precache manifest into this variable at build time.
declare const __WB_MANIFEST: Array<{ url: string; revision: string | null }>;

// Cast self to the correct SW type — the WebWorker lib only provides
// WorkerGlobalScope, but we're running as a ServiceWorker.
const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE_NAME = "smarttrack-v1";

// ── Install: precache all build assets ───────────────────────────────────────
sw.addEventListener("install", (event: ExtendableEvent) => {
  sw.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const urls = (typeof __WB_MANIFEST !== "undefined" ? __WB_MANIFEST : [])
        .map((e) => e.url);
      return cache.addAll(urls).catch(() => {/* ignore individual asset failures */});
    })
  );
});

// ── Activate: drop old caches ────────────────────────────────────────────────
sw.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim())
  );
});

// ── Fetch: cache-first for assets, network-first for navigation ───────────────
sw.addEventListener("fetch", (event: FetchEvent) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Network-first for HTML navigation so deploys land immediately
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request) as Promise<Response>)
    );
    return;
  }

  // Cache-first for same-origin static assets
  if (url.origin === sw.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (cached) => cached ?? fetch(request).then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(request, res.clone()));
          }
          return res;
        })
      )
    );
  }
});

// ── Notification click → bring app to foreground ─────────────────────────────
sw.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) ?? "/";
  event.waitUntil(
    sw.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list: readonly WindowClient[]) => {
        for (const c of list) {
          if ("focus" in c) return c.focus();
        }
        return sw.clients.openWindow(url);
      })
  );
});

// ── Periodic Background Sync ─────────────────────────────────────────────────
// Fires on Android Chrome (installed PWA) when the app is closed.
// iOS does NOT support this — Apple requires a push server for background delivery.
sw.addEventListener("periodicsync", ((event: ExtendableEvent & { tag: string }) => {
  if (event.tag === "smarttrack-reminders") {
    event.waitUntil(checkAndFireScheduledNotifications());
  }
}) as EventListener);

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

    const now         = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const today       = now.getDay();
    const dayOfMonth  = now.getDate();

    for (const notif of notifications) {
      if (!notif.isActive) continue;
      if (notif.time !== currentTime) continue;

      let shouldFire = false;
      if      (notif.frequency === "daily")                       shouldFire = true;
      else if (notif.frequency === "weekly"  && today === 1)      shouldFire = true;
      else if (notif.frequency === "monthly" && dayOfMonth === 1) shouldFire = true;

      if (shouldFire) {
        await sw.registration.showNotification(`SmartTrack · ${notif.title}`, {
          body:  notif.message,
          icon:  "/icons/icon-192.png",
          badge: "/icons/icon-72.png",
          tag:   `smarttrack-${notif.id}`,
          data:  { url: "/" },
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
    const req = indexedDB.open("SmartTrackDB");
    req.onsuccess      = () => resolve(req.result);
    req.onerror        = () => reject(req.error);
    req.onupgradeneeded = () => {/* Dexie owns the schema; SW only reads */};
  });
}

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve) => {
    try {
      const tx  = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror   = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}
