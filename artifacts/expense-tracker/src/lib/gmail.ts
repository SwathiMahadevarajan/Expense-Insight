import { db, generateId, type Transaction } from "./db";

interface GmailMessage { id: string; threadId: string; }
interface GmailMessageFull {
  id: string;
  payload?: {
    headers?: { name: string; value: string }[];
    parts?: GmailPart[];
    body?: { data?: string };
    mimeType?: string;
  };
}
interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

async function gmailFetch(path: string, token: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail API error: ${res.status}`);
  return res.json();
}

function extractText(part: GmailMessageFull["payload"]): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
  }
  if (part.parts) return part.parts.map(p => extractText(p as GmailMessageFull["payload"])).join("\n");
  return "";
}

function parseEmailForTransaction(body: string, subject: string, from: string): Omit<Transaction, "id" | "createdAt" | "updatedAt" | "gmailMessageId"> | null {
  const text = `${subject} ${body}`;

  const isDebit = /debited|payment|spent|charged|purchase|withdrew|deducted/i.test(text);
  const isCredit = /credited|received|refund|cashback|salary|payment received/i.test(text);
  if (!isDebit && !isCredit) return null;

  const amountMatch =
    text.match(/(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
    text.match(/([0-9,]+(?:\.[0-9]{2}))\s*(?:Rs|INR|₹)/i);
  if (!amountMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return null;

  const type: "income" | "expense" = isCredit && !isDebit ? "income" : "expense";

  let merchantName: string | null = null;
  const merchantPatterns = [
    /(?:at|to|from)\s+([A-Z][A-Za-z0-9\s&'.-]{2,40}?)(?:\s+on|\s+via|\s+UPI|\s*\.|\s*$)/i,
    /(?:merchant|payee|beneficiary)[:\s]+([A-Za-z0-9\s&'.-]+?)(?:\s*\n|\.|$)/i,
  ];
  for (const p of merchantPatterns) {
    const m = text.match(p);
    if (m?.[1]?.trim()) { merchantName = m[1].trim().slice(0, 60); break; }
  }

  let date = new Date().toISOString();
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dateMatch) {
    try {
      const parsed = new Date(dateMatch[0]);
      if (!isNaN(parsed.getTime())) date = parsed.toISOString();
    } catch { /* keep now */ }
  }

  // Suggest category
  const categoryMap: Record<string, string> = {
    "cat-food": /swiggy|zomato|food|restaurant|cafe|domino|pizza|kfc|mcdonald/i.source,
    "cat-transport": /uber|ola|rapido|taxi|auto|metro|irctc|flight|petrol|fastag/i.source,
    "cat-shopping": /amazon|flipkart|myntra|shopping|mart|store/i.source,
    "cat-entertainment": /netflix|spotify|prime|hotstar|youtube/i.source,
    "cat-health": /hospital|clinic|pharma|medicine|doctor|health|apollo/i.source,
    "cat-bills": /electricity|water|gas|broadband|airtel|jio|vi|bsnl|recharge/i.source,
    "cat-groceries": /blinkit|zepto|bigbasket|grofer|grocery|supermarket/i.source,
    "cat-salary": /salary|payroll/i.source,
  };

  let categoryId: string | null = null;
  const lowerText = (merchantName || subject).toLowerCase();
  for (const [catId, pattern] of Object.entries(categoryMap)) {
    if (new RegExp(pattern, "i").test(lowerText)) {
      const existing = db.categories.get(catId);
      if (existing) { categoryId = catId; break; }
    }
  }

  const description = merchantName
    ? `${type === "expense" ? "Payment to" : "Receipt from"} ${merchantName}`
    : subject.slice(0, 100) || "Bank transaction";

  return { amount, type, description, merchantName, date, categoryId, accountId: null, importSource: "email", notes: null };
}

export async function syncGmail(accessToken: string): Promise<{ imported: number; skipped: number; errors: number }> {
  // Get last sync time
  const lastSyncSetting = await db.settings.get("gmail_last_sync");
  const lastSync = lastSyncSetting ? parseInt(lastSyncSetting.value) : Date.now() - 30 * 24 * 60 * 60 * 1000;
  const afterDate = Math.floor(lastSync / 1000);

  const query = `after:${afterDate} (transaction OR debited OR credited OR "bank alert" OR payment OR UPI OR NEFT OR IMPS OR "Rs.") -category:promotions -category:social`;

  let imported = 0, skipped = 0, errors = 0;

  try {
    const listData = await gmailFetch(
      `users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`,
      accessToken
    ) as { messages?: GmailMessage[] };

    const messages = listData.messages ?? [];

    for (const msg of messages) {
      try {
        // Check if already imported
        const existing = await db.transactions.where("gmailMessageId").equals(msg.id).count();
        if (existing > 0) { skipped++; continue; }

        const full = await gmailFetch(`users/me/messages/${msg.id}?format=full`, accessToken) as GmailMessageFull;
        const headers = full.payload?.headers ?? [];
        const subject = headers.find(h => h.name === "Subject")?.value ?? "";
        const from = headers.find(h => h.name === "From")?.value ?? "";
        const body = extractText(full.payload) || subject;

        const parsed = parseEmailForTransaction(body, subject, from);
        if (!parsed) { skipped++; continue; }

        const now = new Date().toISOString();
        await db.transactions.add({
          id: generateId(),
          ...parsed,
          gmailMessageId: msg.id,
          createdAt: now,
          updatedAt: now,
        });
        imported++;
      } catch (e) {
        console.warn("Failed to process message", msg.id, e);
        errors++;
      }
    }

    // Update last sync time
    await db.settings.put({ id: "gmail_last_sync", key: "gmail_last_sync", value: String(Date.now()) });
  } catch (e) {
    console.error("Gmail sync error", e);
    throw e;
  }

  return { imported, skipped, errors };
}

export async function getGmailStatus(): Promise<{ lastSyncAt: Date | null }> {
  const lastSync = await db.settings.get("gmail_last_sync");
  return {
    lastSyncAt: lastSync ? new Date(parseInt(lastSync.value)) : null,
  };
}
