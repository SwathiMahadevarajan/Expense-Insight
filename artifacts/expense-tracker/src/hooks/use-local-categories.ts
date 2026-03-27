import { useLiveQuery } from "dexie-react-hooks";
import { db, generateId, type Category } from "@/lib/db";

export function useCategories() {
  const data = useLiveQuery(() => db.categories.orderBy("name").toArray());
  return { data: data ? { categories: data } : undefined, isLoading: data === undefined };
}

export async function createCategory(input: Omit<Category, "id">) {
  const id = generateId();
  await db.categories.add({ ...input, id });
  return id;
}

export async function updateCategory(id: string, input: Partial<Omit<Category, "id">>) {
  await db.categories.update(id, input);
}

export async function deleteCategory(id: string) {
  await db.categories.delete(id);
}
