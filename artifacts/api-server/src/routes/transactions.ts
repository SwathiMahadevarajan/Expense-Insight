import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable, categoriesTable, accountsTable } from "@workspace/db/schema";
import {
  CreateTransactionBody,
  UpdateTransactionBody,
  UpdateTransactionParams,
  DeleteTransactionParams,
  ListTransactionsQueryParams,
  GetTransactionParams,
} from "@workspace/api-zod";
import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/transactions", async (req, res) => {
  try {
    const query = ListTransactionsQueryParams.parse(req.query);
    const conditions = [];

    if (query.accountId) conditions.push(eq(transactionsTable.accountId, query.accountId));
    if (query.categoryId) conditions.push(eq(transactionsTable.categoryId, query.categoryId));
    if (query.type) conditions.push(eq(transactionsTable.type, query.type as "income" | "expense"));
    if (query.startDate) conditions.push(gte(transactionsTable.date, new Date(query.startDate)));
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(transactionsTable.date, end));
    }

    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;

    const [transactions, totalResult] = await Promise.all([
      db
        .select({
          id: transactionsTable.id,
          amount: transactionsTable.amount,
          type: transactionsTable.type,
          description: transactionsTable.description,
          merchantName: transactionsTable.merchantName,
          date: transactionsTable.date,
          categoryId: transactionsTable.categoryId,
          categoryName: categoriesTable.name,
          categoryColor: categoriesTable.color,
          categoryIcon: categoriesTable.icon,
          accountId: transactionsTable.accountId,
          accountName: accountsTable.name,
          notes: transactionsTable.notes,
          importSource: transactionsTable.importSource,
          createdAt: transactionsTable.createdAt,
          updatedAt: transactionsTable.updatedAt,
        })
        .from(transactionsTable)
        .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
        .leftJoin(accountsTable, eq(transactionsTable.accountId, accountsTable.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(transactionsTable.date))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(transactionsTable)
        .where(conditions.length > 0 ? and(...conditions) : undefined),
    ]);

    res.json({ transactions, total: totalResult[0]?.count ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to list transactions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/transactions", async (req, res) => {
  try {
    const body = CreateTransactionBody.parse(req.body);
    const [transaction] = await db
      .insert(transactionsTable)
      .values({ ...body, date: new Date(body.date) })
      .returning();
    res.status(201).json(transaction);
  } catch (err) {
    req.log.error({ err }, "Failed to create transaction");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.get("/transactions/:id", async (req, res) => {
  try {
    const { id } = GetTransactionParams.parse(req.params);
    const [transaction] = await db
      .select({
        id: transactionsTable.id,
        amount: transactionsTable.amount,
        type: transactionsTable.type,
        description: transactionsTable.description,
        merchantName: transactionsTable.merchantName,
        date: transactionsTable.date,
        categoryId: transactionsTable.categoryId,
        categoryName: categoriesTable.name,
        categoryColor: categoriesTable.color,
        categoryIcon: categoriesTable.icon,
        accountId: transactionsTable.accountId,
        accountName: accountsTable.name,
        notes: transactionsTable.notes,
        importSource: transactionsTable.importSource,
        createdAt: transactionsTable.createdAt,
        updatedAt: transactionsTable.updatedAt,
      })
      .from(transactionsTable)
      .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
      .leftJoin(accountsTable, eq(transactionsTable.accountId, accountsTable.id))
      .where(eq(transactionsTable.id, id));

    if (!transaction) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    res.json(transaction);
  } catch (err) {
    req.log.error({ err }, "Failed to get transaction");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/transactions/:id", async (req, res) => {
  try {
    const { id } = UpdateTransactionParams.parse(req.params);
    const body = UpdateTransactionBody.parse(req.body);
    const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
    if (body.date) updateData.date = new Date(body.date as string);

    const [updated] = await db
      .update(transactionsTable)
      .set(updateData)
      .where(eq(transactionsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update transaction");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/transactions/:id", async (req, res) => {
  try {
    const { id } = DeleteTransactionParams.parse(req.params);
    await db.delete(transactionsTable).where(eq(transactionsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete transaction");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
