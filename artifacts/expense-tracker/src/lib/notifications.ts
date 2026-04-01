const APP_NAME = "SmartTrack";
const APP_ICON = "/icons/icon-192.png";
const APP_BADGE = "/icons/icon-72.png";

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Show a notification via the service worker (required on Android Chrome;
 * falls back to window.Notification on desktop browsers without a SW).
 *
 * Using registration.showNotification() instead of new Notification() is
 * critical on mobile — Android Chrome blocks new Notification() from the
 * main thread and silently drops it.
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  icon = APP_ICON,
): Promise<void> {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const payload = {
    body,
    icon,
    badge: APP_BADGE,
    tag: "smarttrack-notification",
    data: { url: "/" },
  };

  // Prefer service-worker showNotification — works on mobile + when locked screen
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(`${APP_NAME} · ${title}`, payload);
      return;
    } catch {
      // SW not yet active or unavailable — fall through to window.Notification
    }
  }

  // Fallback: desktop browsers without an active SW
  try {
    new Notification(`${APP_NAME} · ${title}`, payload);
  } catch {
    // Some browsers throw if called outside a user gesture; ignore silently.
  }
}

export async function sendTransactionNotification(
  description: string,
  amount: string,
  type: "income" | "expense",
): Promise<void> {
  const emoji = type === "income" ? "💰" : "💸";
  await sendLocalNotification(
    `${emoji} ${type === "income" ? "Money received" : "Expense recorded"}`,
    `${description} · ${amount}`,
  );
}

/**
 * Register a Periodic Background Sync so the service worker can fire
 * scheduled reminders even when the app is closed.
 *
 * Support:   Android Chrome (installed PWA) ✓
 *            iOS Safari                      ✗  (Apple requires a push server)
 *            Desktop Chrome                  ✓  (installed PWA only)
 *
 * The minimum interval is enforced by the browser (typically ≥ 1 hour).
 * The SW checks the exact scheduled time when it wakes, so a 1-hour interval
 * means reminders can be up to ~1 hour late — acceptable for daily reminders.
 */
export async function registerPeriodicSync(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!("periodicSync" in reg)) return;
    // Query permission first (Chrome requires the user to have granted it)
    const status = await (navigator.permissions as any).query({ name: "periodic-background-sync" });
    if (status.state !== "granted") return;
    await (reg as any).periodicSync.register("smarttrack-reminders", {
      minInterval: 60 * 60 * 1000, // 1 hour
    });
    console.log("[PWA] Periodic background sync registered");
  } catch (err) {
    // Not supported or permission denied — in-app interval is the fallback
    console.warn("[PWA] Periodic sync unavailable:", err);
  }
}

/** Returns true if Periodic Background Sync is supported and registered. */
export async function isPeriodicSyncRegistered(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!("periodicSync" in reg)) return false;
    const tags = await (reg as any).periodicSync.getTags();
    return (tags as string[]).includes("smarttrack-reminders");
  } catch {
    return false;
  }
}

/**
 * In-app interval fallback: fires scheduled notifications while the tab is open.
 * On mobile, sendLocalNotification routes through the SW so they appear even
 * if the screen is briefly locked while the tab is in the background.
 */
export function scheduleNotifications(
  notifications: Array<{
    title: string;
    message: string;
    time: string;
    frequency: string;
    isActive: boolean;
  }>,
): void {
  const existingId = (window as unknown as Record<string, unknown>)._notifInterval;
  if (existingId) clearInterval(existingId as number);

  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const checkAndNotify = () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const today = now.getDay();
    const dayOfMonth = now.getDate();

    for (const notif of notifications) {
      if (!notif.isActive) continue;
      if (notif.time !== currentTime) continue;

      let shouldFire = false;
      if (notif.frequency === "daily") shouldFire = true;
      else if (notif.frequency === "weekly" && today === 1) shouldFire = true;
      else if (notif.frequency === "monthly" && dayOfMonth === 1) shouldFire = true;

      if (shouldFire) sendLocalNotification(notif.title, notif.message);
    }
  };

  const intervalId = setInterval(checkAndNotify, 60_000);
  (window as unknown as Record<string, unknown>)._notifInterval = intervalId;
}
