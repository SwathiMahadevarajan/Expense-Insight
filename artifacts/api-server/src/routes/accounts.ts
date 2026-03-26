import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { accountsTable, transactionsTable } from "@workspace/db/schema";
import {
  CreateAccountBody,
  UpdateAccountBody,
  UpdateAccountParams,
  DeleteAccountParams,
} from "@workspace/api-zod";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/accounts", async (req, res) => {
  try {
    const accounts = await db.select().from(accountsTable).orderBy(accountsTable.name);

    // Compute current balance for each account
    const accountsWithBalance = await Promise.all(
      accounts.map(async (account) => {
        const result = await db
          .select({
            netChange: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)`,
          })
          .from(transactionsTable)
          .where(eq(transactionsTable.accountId, account.id));

        const netChange = result[0]?.netChange ?? 0;
        const currentBalance = account.openingBalance + netChange;

        return {
          ...account,
          currentBalance,
        };
      })
    );

    res.json({ accounts: accountsWithBalance });
  } catch (err) {
    req.log.error({ err }, "Failed to list accounts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/accounts", async (req, res) => {
  try {
    const body = CreateAccountBody.parse(req.body);
    const [account] = await db.insert(accountsTable).values(body).returning();
    res.status(201).json({ ...account, currentBalance: account.openingBalance });
  } catch (err) {
    req.log.error({ err }, "Failed to create account");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.put("/accounts/:id", async (req, res) => {
  try {
    const { id } = UpdateAccountParams.parse(req.params);
    const body = UpdateAccountBody.parse(req.body);
    const [updated] = await db
      .update(accountsTable)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(accountsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    const result = await db
      .select({
        netChange: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)`,
      })
      .from(transactionsTable)
      .where(eq(transactionsTable.accountId, id));

    const netChange = result[0]?.netChange ?? 0;
    res.json({ ...updated, currentBalance: updated.openingBalance + netChange });
  } catch (err) {
    req.log.error({ err }, "Failed to update account");
    res.status(400).json({ error: "Invalid request" });
  }
});

router.delete("/accounts/:id", async (req, res) => {
  try {
    const { id } = DeleteAccountParams.parse(req.params);
    await db.delete(accountsTable).where(eq(accountsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete account");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
