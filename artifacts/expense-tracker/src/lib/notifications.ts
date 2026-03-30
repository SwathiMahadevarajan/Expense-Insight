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

export function sendLocalNotification(title: string, body: string, icon = APP_ICON) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(`${APP_NAME} · ${title}`, {
    body,
    icon,
    badge: APP_BADGE,
    tag: "smarttrack-notification",
  });
}

export function sendTransactionNotification(description: string, amount: string, type: "income" | "expense") {
  const emoji = type === "income" ? "💰" : "💸";
  sendLocalNotification(
    `${emoji} ${type === "income" ? "Money received" : "Expense recorded"}`,
    `${description} · ${amount}`
  );
}

export function scheduleNotifications(notifications: Array<{ title: string; message: string; time: string; frequency: string; isActive: boolean }>) {
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

  const intervalId = setInterval(checkAndNotify, 60000);
  (window as unknown as Record<string, unknown>)._notifInterval = intervalId;
}
