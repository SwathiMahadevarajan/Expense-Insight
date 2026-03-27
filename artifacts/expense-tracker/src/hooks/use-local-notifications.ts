import { useLiveQuery } from "dexie-react-hooks";
import { db, generateId, type NotificationSetting } from "@/lib/db";

export function useNotificationSettings() {
  const data = useLiveQuery(() => db.notifications.toArray());
  return { data: data ? { notifications: data } : undefined, isLoading: data === undefined };
}

export async function createNotification(input: Omit<NotificationSetting, "id" | "createdAt">) {
  const id = generateId();
  const now = new Date().toISOString();
  await db.notifications.add({ ...input, id, createdAt: now });
  return id;
}

export async function updateNotification(id: string, input: Partial<Omit<NotificationSetting, "id">>) {
  await db.notifications.update(id, input);
}

export async function deleteNotification(id: string) {
  await db.notifications.delete(id);
}
