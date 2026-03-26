import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db/schema";
import { CreateCategoryBody, UpdateCategoryBody, UpdateCategoryParams, DeleteCategoryParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/categories", async (req, res) => {
  try {
    const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
    res.json({ categories });
  } catch (err) {
    req.log.error({ err }, "Failed to list categories");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const body = CreateCategoryBody.parse(req.body);
    const [category] = await db.insert(categoriesTable).values(body).returning();
    res.status(201).json(category);
  } catch (err) {
    req.log.error({ err }, "Failed to create category");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.put("/categories/:id", async (req, res) => {
  try {
    const { id } = UpdateCategoryParams.parse(req.params);
    const body = UpdateCategoryBody.parse(req.body);
    const [updated] = await db.update(categoriesTable).set(body).where(eq(categoriesTable.id, id)).returning();
    if (!updated) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update category");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const { id } = DeleteCategoryParams.parse(req.params);
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete category");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
