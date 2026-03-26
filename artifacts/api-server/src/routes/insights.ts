import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable, categoriesTable, accountsTable } from "@workspace/db/schema";
import { GetInsightsSummaryQueryParams, GetSpendingByCategoryQueryParams, GetDailySpendingQueryParams } from "@workspace/api-zod";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const router: IRouter = Router();

function getDateRange(period: string, startDate?: string, endDate?: string) {
  const now = new Date();
  let start: Date, end: Date = new Date(now), label = "";
  end.setHours(23, 59, 59, 999);

  if (period === "custom" && startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate); end.setHours(23, 59, 59, 999);
    label = `${startDate} to ${endDate}`;
  } else if (period === "week") {
    start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0,0,0,0);
    label = "Last 7 days";
  } else if (period === "quarter") {
    start = new Date(now); start.setMonth(now.getMonth() - 3); start.setHours(0,0,0,0);
    label = "Last 3 months";
  } else if (period === "year") {
    start = new Date(now.getFullYear(), 0, 1); start.setHours(0,0,0,0);
    label = `Year ${now.getFullYear()}`;
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1); start.setHours(0,0,0,0);
    label = now.toLocaleString("default", { month: "long", year: "numeric" });
  }
  return { start, end, label };
}

router.get("/insights/summary", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const query = GetInsightsSummaryQueryParams.parse(req.query);
    const { start, end, label } = getDateRange(query.period ?? "month", query.startDate, query.endDate);
    const userId = req.user.id;

    const dateConditions = and(
      eq(transactionsTable.userId, userId),
      gte(transactionsTable.date, start),
      lte(transactionsTable.date, end)
    );

    const [totals] = await db.select({
      totalIncome: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
      totalExpenses: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
      transactionCount: sql<number>`COUNT(*)`,
    }).from(transactionsTable).where(dateConditions);

    const totalIncome = Number(totals?.totalIncome ?? 0);
    const totalExpenses = Number(totals?.totalExpenses ?? 0);
    const transactionCount = Number(totals?.transactionCount ?? 0);
    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000*60*60*24)));
    const dailyAverage = totalExpenses / days;

    const topCategoryResult = await db.select({
      categoryName: categoriesTable.name,
      total: sql<number>`SUM(${transactionsTable.amount})`,
    }).from(transactionsTable)
      .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
      .where(and(dateConditions, eq(transactionsTable.type, "expense")))
      .groupBy(categoriesTable.name)
      .orderBy(sql`SUM(${transactionsTable.amount}) DESC`).limit(1);

    const accounts = await db.select().from(accountsTable).where(eq(accountsTable.userId, userId));
    const accountBalances = await Promise.all(accounts.map(async (account) => {
      const result = await db.select({
        netChange: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)`,
      }).from(transactionsTable).where(eq(transactionsTable.accountId, account.id));
      return { accountId: account.id, accountName: account.name, balance: account.openingBalance + Number(result[0]?.netChange ?? 0) };
    }));

    res.json({
      totalIncome, totalExpenses, netSavings, savingsRate, dailyAverage, transactionCount,
      topCategory: topCategoryResult[0]?.categoryName ?? null,
      topCategoryAmount: topCategoryResult[0]?.total ? Number(topCategoryResult[0].total) : null,
      periodLabel: label,
      accountBalances,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get insights summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/insights/spending-by-category", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const query = GetSpendingByCategoryQueryParams.parse(req.query);
    const { start, end } = getDateRange(query.period ?? "month", query.startDate, query.endDate);
    const userId = req.user.id;

    const dateConditions = and(
      eq(transactionsTable.userId, userId),
      gte(transactionsTable.date, start),
      lte(transactionsTable.date, end),
      eq(transactionsTable.type, "expense")
    );

    const [totalResult] = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(transactionsTable).where(dateConditions);
    const total = Number(totalResult?.total ?? 0);

    const byCategory = await db.select({
      categoryId: categoriesTable.id,
      categoryName: sql<string>`COALESCE(${categoriesTable.name}, 'Uncategorized')`,
      categoryColor: sql<string>`COALESCE(${categoriesTable.color}, '#94a3b8')`,
      categoryIcon: sql<string>`COALESCE(${categoriesTable.icon}, '📦')`,
      amount: sql<number>`SUM(${transactionsTable.amount})`,
      transactionCount: sql<number>`COUNT(*)`,
    }).from(transactionsTable)
      .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
      .where(dateConditions)
      .groupBy(categoriesTable.id, categoriesTable.name, categoriesTable.color, categoriesTable.icon)
      .orderBy(sql`SUM(${transactionsTable.amount}) DESC`);

    const data = byCategory.map(row => ({
      ...row,
      amount: Number(row.amount),
      transactionCount: Number(row.transactionCount),
      percentage: total > 0 ? (Number(row.amount) / total) * 100 : 0,
    }));

    res.json({ data });
  } catch (err) {
    req.log.error({ err }, "Failed to get spending by category");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/insights/daily-spending", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const query = GetDailySpendingQueryParams.parse(req.query);
    const { start, end } = getDateRange(query.period ?? "month", query.startDate, query.endDate);
    const userId = req.user.id;

    const dailyData = await db.select({
      date: sql<string>`DATE(${transactionsTable.date})`,
      amount: sql<number>`COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)`,
      income: sql<number>`COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)`,
      transactionCount: sql<number>`COUNT(*)`,
    }).from(transactionsTable)
      .where(and(eq(transactionsTable.userId, userId), gte(transactionsTable.date, start), lte(transactionsTable.date, end)))
      .groupBy(sql`DATE(${transactionsTable.date})`)
      .orderBy(sql`DATE(${transactionsTable.date})`);

    const data = dailyData.map(row => ({
      date: row.date,
      amount: Number(row.amount),
      income: Number(row.income),
      transactionCount: Number(row.transactionCount),
    }));

    res.json({ data });
  } catch (err) {
    req.log.error({ err }, "Failed to get daily spending");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
