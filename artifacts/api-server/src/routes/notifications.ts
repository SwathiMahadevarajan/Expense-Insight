import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { CreateNotificationBody, UpdateNotificationBody, UpdateNotificationParams, DeleteNotificationParams } from "@workspace/api-zod";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/notifications", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const notifications = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, req.user.id)).orderBy(notificationsTable.createdAt);
    res.json({ notifications });
  } catch (err) {
    req.log.error({ err }, "Failed to list notifications");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notifications", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const body = CreateNotificationBody.parse(req.body);
    const [notification] = await db.insert(notificationsTable).values({ ...body, userId: req.user.id }).returning();
    res.status(201).json(notification);
  } catch (err) {
    req.log.error({ err }, "Failed to create notification");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.put("/notifications/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { id } = UpdateNotificationParams.parse(req.params);
    const body = UpdateNotificationBody.parse(req.body);
    const [updated] = await db.update(notificationsTable).set(body)
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user.id))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update notification");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/notifications/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const { id } = DeleteNotificationParams.parse(req.params);
    await db.delete(notificationsTable)
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, req.user.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete notification");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
