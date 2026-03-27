export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendLocalNotification(title: string, body: string, icon = "/icons/icon-192.png") {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, { body, icon, badge: "/icons/icon-72.png" });
}

export function scheduleNotifications(notifications: Array<{ title: string; message: string; time: string; frequency: string; isActive: boolean }>) {
  // Clear any existing scheduled notifications interval
  const existingId = (window as unknown as Record<string, unknown>)._notifInterval;
  if (existingId) clearInterval(existingId as number);

  if (Notification.permission !== "granted") return;

  const checkAndNotify = () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const today = now.getDay(); // 0 = Sunday
    const dayOfMonth = now.getDate();

    for (const notif of notifications) {
      if (!notif.isActive) continue;
      if (notif.time !== currentTime) continue;

      let shouldFire = false;
      if (notif.frequency === "daily") shouldFire = true;
      else if (notif.frequency === "weekly" && today === 1) shouldFire = true; // Monday
      else if (notif.frequency === "monthly" && dayOfMonth === 1) shouldFire = true;

      if (shouldFire) sendLocalNotification(notif.title, notif.message);
    }
  };

  // Check every minute
  const intervalId = setInterval(checkAndNotify, 60000);
  (window as unknown as Record<string, unknown>)._notifInterval = intervalId;
}
