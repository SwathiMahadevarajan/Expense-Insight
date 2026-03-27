import { useLiveQuery } from "dexie-react-hooks";
import { db, generateId, type Account } from "@/lib/db";

export function useAccounts() {
  const data = useLiveQuery(async () => {
    const accounts = await db.accounts.toArray();
    const transactions = await db.transactions.toArray();

    return accounts.map(account => {
      const txs = transactions.filter(t => t.accountId === account.id);
      const netChange = txs.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
      return { ...account, currentBalance: account.openingBalance + netChange };
    });
  });

  return { data: data ? { accounts: data } : undefined, isLoading: data === undefined };
}

export async function createAccount(input: Omit<Account, "id" | "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const id = generateId();

  // If this is the first account, make it default
  const count = await db.accounts.count();
  await db.accounts.add({ ...input, id, isDefault: count === 0, createdAt: now, updatedAt: now });
  return id;
}

export async function updateAccount(id: string, input: Partial<Omit<Account, "id" | "createdAt">>) {
  await db.accounts.update(id, { ...input, updatedAt: new Date().toISOString() });
}

export async function deleteAccount(id: string) {
  await db.accounts.delete(id);
}
