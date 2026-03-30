import Dexie, { type Table } from "dexie";

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: "expense" | "income" | "both";
  isDefault?: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: "bank" | "cash" | "credit_card" | "wallet" | "other";
  openingBalance: number;
  currency: string;
  color: string;
  icon: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense";
  description: string;
  merchantName?: string | null;
  date: string;
  categoryId?: string | null;
  accountId?: string | null;
  notes?: string | null;
  importSource: "manual" | "email";
  gmailMessageId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSetting {
  id: string;
  title: string;
  message: string;
  type: string;
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  isActive: boolean;
  createdAt: string;
}

export interface AppSettings {
  id: string;
  key: string;
  value: string;
}

class SmartTrackDB extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  accounts!: Table<Account, string>;
  notifications!: Table<NotificationSetting, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super("SmartTrackDB");

    this.version(1).stores({
      transactions: "id, date, type, categoryId, accountId, importSource, gmailMessageId, createdAt",
      categories: "id, name, type",
      accounts: "id, name, isDefault",
      notifications: "id, type, isActive",
      settings: "id, key",
    });
  }
}

export const db = new SmartTrackDB();

const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-food", name: "Food & Dining", icon: "🍽️", color: "#f97316", type: "expense", isDefault: true },
  { id: "cat-transport", name: "Transport", icon: "🚗", color: "#3b82f6", type: "expense", isDefault: true },
  { id: "cat-shopping", name: "Shopping", icon: "🛍️", color: "#8b5cf6", type: "expense", isDefault: true },
  { id: "cat-entertainment", name: "Entertainment", icon: "🎬", color: "#ec4899", type: "expense", isDefault: true },
  { id: "cat-health", name: "Health", icon: "🏥", color: "#ef4444", type: "expense", isDefault: true },
  { id: "cat-bills", name: "Bills & Utilities", icon: "⚡", color: "#eab308", type: "expense", isDefault: true },
  { id: "cat-groceries", name: "Groceries", icon: "🛒", color: "#22c55e", type: "expense", isDefault: true },
  { id: "cat-salary", name: "Salary", icon: "💰", color: "#10b981", type: "income", isDefault: true },
  { id: "cat-investment", name: "Investment", icon: "📈", color: "#06b6d4", type: "income", isDefault: true },
  { id: "cat-other", name: "Other", icon: "📦", color: "#94a3b8", type: "both", isDefault: true },
];

export async function seedDefaultData() {
  const existingCats = await db.categories.count();
  if (existingCats === 0) {
    await db.categories.bulkPut(DEFAULT_CATEGORIES);
  }
}

export function generateId(): string {
  // crypto.randomUUID() is not available on iOS < 15.4
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15);
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// Backup/restore
export async function exportBackup() {
  const [transactions, categories, accounts, notifications] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.accounts.toArray(),
    db.notifications.toArray(),
  ]);

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { transactions, categories, accounts, notifications },
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `smarttrack-backup-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<{ transactions: number; categories: number; accounts: number }> {
  const text = await file.text();
  const backup = JSON.parse(text);

  if (!backup.data) throw new Error("Invalid backup file");

  const { transactions = [], categories = [], accounts = [], notifications = [] } = backup.data;

  await db.transaction("rw", [db.transactions, db.categories, db.accounts, db.notifications], async () => {
    if (categories.length > 0) await db.categories.bulkPut(categories);
    if (accounts.length > 0) await db.accounts.bulkPut(accounts);
    if (transactions.length > 0) await db.transactions.bulkPut(transactions);
    if (notifications.length > 0) await db.notifications.bulkPut(notifications);
  });

  return {
    transactions: transactions.length,
    categories: categories.length,
    accounts: accounts.length,
  };
}
