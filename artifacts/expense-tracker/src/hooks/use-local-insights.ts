import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export type InsightPeriod = "week" | "month" | "quarter" | "year";

function getDateRange(period: InsightPeriod) {
  const now = new Date();
  let start: Date;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (period) {
    case "week":
      start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0, 0, 0, 0); break;
    case "quarter":
      start = new Date(now); start.setMonth(now.getMonth() - 3); start.setHours(0, 0, 0, 0); break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1); break;
    default: // month
      start = new Date(now.getFullYear(), now.getMonth(), 1); break;
  }
  return { start, end };
}

export function useInsightsSummary(period: InsightPeriod = "month") {
  const data = useLiveQuery(async () => {
    const { start, end } = getDateRange(period);
    const transactions = await db.transactions
      .where("date")
      .between(start.toISOString(), end.toISOString(), true, true)
      .toArray();

    const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const dailyAverage = totalExpenses / days;

    // Top category
    const categories = await db.categories.toArray();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
    const expTxs = transactions.filter(t => t.type === "expense" && t.categoryId);
    const catSpend: Record<string, number> = {};
    for (const t of expTxs) {
      catSpend[t.categoryId!] = (catSpend[t.categoryId!] ?? 0) + t.amount;
    }
    const topCatId = Object.entries(catSpend).sort(([, a], [, b]) => b - a)[0]?.[0];

    return {
      totalIncome, totalExpenses, netSavings, savingsRate, dailyAverage,
      transactionCount: transactions.length,
      topCategory: topCatId ? catMap[topCatId]?.name ?? null : null,
      topCategoryAmount: topCatId ? catSpend[topCatId] : null,
    };
  }, [period]);

  return { data, isLoading: data === undefined };
}

export function useSpendingByCategory(period: InsightPeriod = "month") {
  const data = useLiveQuery(async () => {
    const { start, end } = getDateRange(period);
    const transactions = await db.transactions
      .where("date")
      .between(start.toISOString(), end.toISOString(), true, true)
      .toArray();

    const categories = await db.categories.toArray();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

    const expTxs = transactions.filter(t => t.type === "expense");
    const total = expTxs.reduce((s, t) => s + t.amount, 0);

    const catSpend: Record<string, { amount: number; count: number }> = {};
    for (const t of expTxs) {
      const key = t.categoryId ?? "__uncategorized__";
      if (!catSpend[key]) catSpend[key] = { amount: 0, count: 0 };
      catSpend[key].amount += t.amount;
      catSpend[key].count++;
    }

    const result = Object.entries(catSpend).map(([catId, { amount, count }]) => {
      const cat = catId === "__uncategorized__" ? null : catMap[catId];
      return {
        categoryId: catId === "__uncategorized__" ? null : catId,
        categoryName: cat?.name ?? "Uncategorized",
        categoryColor: cat?.color ?? "#94a3b8",
        categoryIcon: cat?.icon ?? "📦",
        amount,
        transactionCount: count,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      };
    }).sort((a, b) => b.amount - a.amount);

    return { data: result };
  }, [period]);

  return { data, isLoading: data === undefined };
}

/**
 * Aggregate expense spending by day-of-week (Mon–Sun) for a given period.
 * Used for the day-of-week heatmap on the Insights page.
 */
export function useWeekdaySpending(period: InsightPeriod = "month") {
  const data = useLiveQuery(async () => {
    const { start, end } = getDateRange(period);
    const transactions = await db.transactions
      .where("date")
      .between(start.toISOString(), end.toISOString(), true, true)
      .toArray();

    // Display order: Mon–Sun. JS getDay() returns 0=Sun … 6=Sat.
    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const totals = Array.from({ length: 7 }, () => ({ amount: 0, count: 0 }));

    for (const t of transactions) {
      if (t.type !== "expense") continue;
      const jsDay = new Date(t.date).getDay();     // 0=Sun
      const idx   = jsDay === 0 ? 6 : jsDay - 1;  // remap → Mon=0, Sun=6
      totals[idx].amount += t.amount;
      totals[idx].count++;
    }

    return DAYS.map((day, i) => ({ day, ...totals[i] }));
  }, [period]);

  return { data, isLoading: data === undefined };
}

/** Summary for a specific calendar month — used by the dashboard month switcher. */
export function useMonthSummary(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end   = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);

  const data = useLiveQuery(async () => {
    const transactions = await db.transactions
      .where("date")
      .between(start.toISOString(), end.toISOString(), true, true)
      .toArray();

    const totalIncome   = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const netSavings    = totalIncome - totalExpenses;
    const savingsRate   = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
    const daysInMonth   = end.getDate();
    const dailyAverage  = totalExpenses / Math.max(1, daysInMonth);

    const categories = await db.categories.toArray();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
    const catSpend: Record<string, number> = {};
    for (const t of transactions.filter(t => t.type === "expense" && t.categoryId)) {
      catSpend[t.categoryId!] = (catSpend[t.categoryId!] ?? 0) + t.amount;
    }
    const topCatId = Object.entries(catSpend).sort(([, a], [, b]) => b - a)[0]?.[0];

    return {
      totalIncome, totalExpenses, netSavings, savingsRate, dailyAverage,
      transactionCount: transactions.length,
      topCategory: topCatId ? catMap[topCatId]?.name ?? null : null,
      topCategoryAmount: topCatId ? catSpend[topCatId] : null,
    };
  }, [start.toISOString(), end.toISOString()]);

  return { data, isLoading: data === undefined };
}

export function useDailySpending(period: InsightPeriod = "month") {
  const data = useLiveQuery(async () => {
    const { start, end } = getDateRange(period);
    const transactions = await db.transactions
      .where("date")
      .between(start.toISOString(), end.toISOString(), true, true)
      .toArray();

    const daily: Record<string, { amount: number; income: number; transactionCount: number }> = {};
    for (const t of transactions) {
      const key = t.date.split("T")[0];
      if (!daily[key]) daily[key] = { amount: 0, income: 0, transactionCount: 0 };
      if (t.type === "expense") daily[key].amount += t.amount;
      else daily[key].income += t.amount;
      daily[key].transactionCount++;
    }

    return {
      data: Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }))
    };
  }, [period]);

  return { data, isLoading: data === undefined };
}
