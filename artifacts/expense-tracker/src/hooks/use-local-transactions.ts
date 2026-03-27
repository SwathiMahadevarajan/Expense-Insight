import { useLiveQuery } from "dexie-react-hooks";
import { db, generateId, type Transaction } from "@/lib/db";

export interface TransactionFilter {
  accountId?: string;
  categoryId?: string;
  type?: "income" | "expense";
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export function useTransactions(filter: TransactionFilter = {}) {
  const data = useLiveQuery(async () => {
    let query = db.transactions.orderBy("date").reverse();
    const all = await query.toArray();
    let filtered = all;

    if (filter.accountId) filtered = filtered.filter(t => t.accountId === filter.accountId);
    if (filter.categoryId) filtered = filtered.filter(t => t.categoryId === filter.categoryId);
    if (filter.type) filtered = filtered.filter(t => t.type === filter.type);
    if (filter.startDate) filtered = filtered.filter(t => new Date(t.date) >= filter.startDate!);
    if (filter.endDate) {
      const end = new Date(filter.endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(t => new Date(t.date) <= end);
    }

    const total = filtered.length;
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    const transactions = filtered.slice(offset, offset + limit);

    const categories = await db.categories.toArray();
    const accounts = await db.accounts.toArray();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
    const accMap = Object.fromEntries(accounts.map(a => [a.id, a]));

    return {
      transactions: transactions.map(t => ({
        ...t,
        categoryName: t.categoryId ? catMap[t.categoryId]?.name ?? null : null,
        categoryColor: t.categoryId ? catMap[t.categoryId]?.color ?? null : null,
        categoryIcon: t.categoryId ? catMap[t.categoryId]?.icon ?? null : null,
        accountName: t.accountId ? accMap[t.accountId]?.name ?? null : null,
      })),
      total,
    };
  }, [filter.accountId, filter.categoryId, filter.type, filter.startDate?.toISOString(), filter.endDate?.toISOString(), filter.limit, filter.offset]);

  return { data, isLoading: data === undefined };
}

export async function createTransaction(input: Omit<Transaction, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const id = generateId();
  await db.transactions.add({ ...input, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateTransaction(id: string, input: Partial<Omit<Transaction, "id" | "createdAt">>) {
  await db.transactions.update(id, { ...input, updatedAt: new Date().toISOString() });
}

export async function deleteTransaction(id: string) {
  await db.transactions.delete(id);
}

export async function bulkDeleteTransactions(ids: string[]) {
  await db.transactions.bulkDelete(ids);
}

export async function bulkUpdateTransactions(ids: string[], patch: Partial<Omit<Transaction, "id" | "createdAt">>) {
  const now = new Date().toISOString();
  await db.transaction("rw", db.transactions, async () => {
    for (const id of ids) {
      await db.transactions.update(id, { ...patch, updatedAt: now });
    }
  });
}
